import {
  resolveDeskMode,
  runFraudScoring,
  runInquiryClassification,
  runInventoryPrediction,
  suggestReorderQuantity,
  type InquiryInput,
  type OrderInput,
  type ReorderRequest,
  type ReturnRequest,
  type StoredInquiry,
  type StoredOrder,
  type StoredProduct,
} from "@helix/core";
import { getMockShopifyClient, getLiveShopifyClient } from "./shopify";
import {
  commerceGate,
  supabaseProbeDesk,
  supabaseListInquiries,
  supabaseListOrders,
  supabaseListProducts,
  supabaseListReorders,
  supabaseListReturns,
  supabaseUpsertInquiry,
  supabaseUpsertOrder,
  supabaseUpsertProduct,
  supabaseUpsertReorder,
  supabaseUpsertReturn,
} from "./supabase-commerce";

const orders = new Map<string, StoredOrder>();
const products = new Map<string, StoredProduct>();
const inquiries = new Map<string, StoredInquiry>();
const reorders = new Map<string, ReorderRequest>();
const returns = new Map<string, ReturnRequest>();
let seeded = false;
let seeding: Promise<void> | null = null;

function id(prefix: string, seed: string): string {
  // Slicing the sanitized seed (rather than hashing it) previously truncated every
  // "gid://shopify/Order/N" id down to the same 16-char prefix, colliding all seeded
  // orders/products into a single Map entry. Keep the trailing digits so distinct
  // Shopify GIDs stay distinct.
  const clean = seed.replace(/[^a-z0-9]/gi, "");
  return `${prefix}-${clean.slice(-16)}`;
}

function randomId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const MOCK_INQUIRIES: InquiryInput[] = [
  {
    customerEmail: "priya.nair@example.com",
    inquiryText: "Hi, where is my order? It's been 5 days since I placed it.",
  },
  {
    customerEmail: "marcus.webb@example.com",
    inquiryText:
      "The bag arrived with a broken zipper, this is unacceptable, I want a refund immediately.",
  },
  {
    customerEmail: "sofia.reyes@example.com",
    inquiryText: "Does the speaker set come in a matte black finish?",
  },
  {
    customerEmail: "liam.oconnor@example.com",
    inquiryText:
      "I've emailed twice with no response, this is the worst service, I'm disputing the charge with my bank.",
  },
];

async function applyDemoCatalog(): Promise<void> {
  seeding = (async () => {
    orders.clear();
    products.clear();
    inquiries.clear();
    const client = getMockShopifyClient();
    const [orderInputs, productInputs] = await Promise.all([
      client.fetchOrders(),
      client.fetchProducts(),
    ]);

    for (const input of orderInputs) {
      const scored = await runFraudScoring(input);
      const order: StoredOrder = {
        ...input,
        ...scored,
        id: id("order", input.shopifyOrderId),
      };
      orders.set(order.id, order);
    }

    for (const input of productInputs) {
      const predicted = await runInventoryPrediction(input);
      const product: StoredProduct = {
        ...input,
        ...predicted,
        id: id("product", input.shopifyProductId),
      };
      products.set(product.id, product);
    }

    for (const input of MOCK_INQUIRIES) {
      const classified = await runInquiryClassification(input);
      const inquiry: StoredInquiry = {
        ...input,
        ...classified,
        id: id("inquiry", input.customerEmail),
        createdAt: new Date().toISOString(),
        status: "pending",
      };
      inquiries.set(inquiry.id, inquiry);
    }

    seeded = true;
    seeding = null;
  })();

  return seeding;
}

/** Shopify credentials are what turns this desk live. */
function shopifyConnected(): boolean {
  return Boolean(getLiveShopifyClient());
}

const PROBE_TTL_MS = 10_000;
let lastProbe = 0;

/**
 * Decides demo vs live. Connection is checked on every call (cheap); the Supabase probe for real
 * orders is throttled. If the mode flips, memory is dropped so demo and real data never mix.
 */
async function ensureDeskMode(): Promise<void> {
  const connected = shopifyConnected();
  let remoteRecords = commerceGate.mode() === "live" ? 1 : 0;
  if (!connected && Date.now() - lastProbe > PROBE_TTL_MS) {
    lastProbe = Date.now();
    remoteRecords = (await supabaseProbeDesk()).hasOrders ? 1 : 0;
  } else if (!connected && commerceGate.mode() !== "live") {
    remoteRecords = 0;
  }
  const changed = commerceGate.evaluate({ connected, remoteRecords });
  if (changed) {
    orders.clear();
    products.clear();
    inquiries.clear();
    reorders.clear();
    returns.clear();
    seeded = false;
    seeding = null;
  }
}

export function currentDeskMode(): "demo" | "live" {
  const m = commerceGate.mode();
  return m === "unknown" ? resolveDeskMode({ connected: shopifyConnected(), realRecords: 0 }) : m;
}

async function seedIfNeeded(): Promise<void> {
  await ensureDeskMode();
  if (seeded) return;
  if (seeding) return seeding;
  if (currentDeskMode() !== "demo") {
    seeded = true;
    return;
  }
  return applyDemoCatalog();
}

export async function listOrders(): Promise<StoredOrder[]> {
  await seedIfNeeded();
  const remote = await supabaseListOrders();
  if (remote && remote.length > 0) {
    for (const order of remote) orders.set(order.id, order);
    return remote;
  }
  return [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveOrder(order: StoredOrder): Promise<StoredOrder> {
  await seedIfNeeded();
  orders.set(order.id, order);
  await supabaseUpsertOrder(order);
  return order;
}

export async function getOrder(orderId: string): Promise<StoredOrder | null> {
  await seedIfNeeded();
  if (orders.has(orderId)) return orders.get(orderId) ?? null;
  const all = await listOrders();
  return all.find((o) => o.id === orderId) ?? null;
}

export async function patchOrder(
  orderId: string,
  patch: Partial<
    Pick<
      StoredOrder,
      "reviewedBy" | "reviewedAt" | "reviewDecision" | "requiresReview" | "fulfillmentStatus" | "financialStatus"
    >
  >
): Promise<StoredOrder | null> {
  const current = await getOrder(orderId);
  if (!current) return null;
  return saveOrder({ ...current, ...patch });
}

export async function listProducts(): Promise<StoredProduct[]> {
  await seedIfNeeded();
  const remote = await supabaseListProducts();
  if (remote && remote.length > 0) {
    for (const product of remote) products.set(product.id, product);
    return remote;
  }
  return [...products.values()].sort((a, b) => a.predictedStockoutDays - b.predictedStockoutDays);
}

export async function saveProduct(product: StoredProduct): Promise<StoredProduct> {
  await seedIfNeeded();
  products.set(product.id, product);
  await supabaseUpsertProduct(product);
  return product;
}

export async function getProduct(productId: string): Promise<StoredProduct | null> {
  await seedIfNeeded();
  if (products.has(productId)) return products.get(productId) ?? null;
  const all = await listProducts();
  return all.find((p) => p.id === productId) ?? null;
}

export async function listReorders(): Promise<ReorderRequest[]> {
  await seedIfNeeded();
  const remote = await supabaseListReorders();
  if (remote && remote.length > 0) {
    for (const r of remote) reorders.set(r.id, r);
    return remote;
  }
  return [...reorders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createReorderRequest(productId: string): Promise<ReorderRequest | null> {
  await seedIfNeeded();
  const product = await getProduct(productId);
  if (!product) return null;
  const reorder: ReorderRequest = {
    id: randomId("reorder"),
    productId: product.id,
    sku: product.sku,
    title: product.title,
    quantitySuggested: suggestReorderQuantity(product),
    status: "draft",
    createdAt: new Date().toISOString(),
  };
  reorders.set(reorder.id, reorder);
  await supabaseUpsertReorder(reorder);
  return reorder;
}

export async function patchReorderRequest(
  reorderId: string,
  patch: Partial<Pick<ReorderRequest, "status" | "notes" | "orderedAt" | "receivedAt">>
): Promise<ReorderRequest | null> {
  await seedIfNeeded();
  const current = reorders.get(reorderId) ?? (await listReorders()).find((r) => r.id === reorderId);
  if (!current) return null;
  const next: ReorderRequest = { ...current, ...patch };
  reorders.set(next.id, next);
  await supabaseUpsertReorder(next);
  return next;
}

export async function listReturns(): Promise<ReturnRequest[]> {
  await seedIfNeeded();
  const remote = await supabaseListReturns();
  if (remote && remote.length > 0) {
    for (const r of remote) returns.set(r.id, r);
    return remote;
  }
  return [...returns.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createReturnRequest(input: {
  orderId: string;
  reason: string;
  refundAmount: number;
  restock: boolean;
}): Promise<ReturnRequest | null> {
  await seedIfNeeded();
  const order = await getOrder(input.orderId);
  if (!order) return null;
  const request: ReturnRequest = {
    id: randomId("return"),
    orderId: order.id,
    shopifyOrderId: order.shopifyOrderId,
    customerEmail: order.customerEmail,
    reason: input.reason,
    refundAmount: input.refundAmount,
    restock: input.restock,
    status: "requested",
    createdAt: new Date().toISOString(),
  };
  returns.set(request.id, request);
  await supabaseUpsertReturn(request);
  return request;
}

export async function patchReturnRequest(
  returnId: string,
  patch: Partial<Pick<ReturnRequest, "status" | "resolvedBy" | "resolvedAt" | "shopifyRefundId">>
): Promise<ReturnRequest | null> {
  await seedIfNeeded();
  const current = returns.get(returnId) ?? (await listReturns()).find((r) => r.id === returnId);
  if (!current) return null;
  const next: ReturnRequest = { ...current, ...patch };
  returns.set(next.id, next);
  await supabaseUpsertReturn(next);
  return next;
}

export async function listInquiries(): Promise<StoredInquiry[]> {
  await seedIfNeeded();
  const remote = await supabaseListInquiries();
  if (remote && remote.length > 0) {
    for (const inquiry of remote) inquiries.set(inquiry.id, inquiry);
    return remote;
  }
  return [...inquiries.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveInquiry(inquiry: StoredInquiry): Promise<StoredInquiry> {
  await seedIfNeeded();
  inquiries.set(inquiry.id, inquiry);
  await supabaseUpsertInquiry(inquiry);
  return inquiry;
}

export async function getInquiry(inquiryId: string): Promise<StoredInquiry | null> {
  await seedIfNeeded();
  if (inquiries.has(inquiryId)) return inquiries.get(inquiryId) ?? null;
  const all = await listInquiries();
  return all.find((i) => i.id === inquiryId) ?? null;
}

export async function ingestInquiry(input: InquiryInput): Promise<StoredInquiry> {
  await seedIfNeeded();
  const classified = await runInquiryClassification(input);
  const inquiry: StoredInquiry = {
    ...input,
    ...classified,
    id: randomId("inquiry"),
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  return saveInquiry(inquiry);
}

export async function patchInquiry(
  inquiryId: string,
  patch: Partial<Pick<StoredInquiry, "status">>
): Promise<StoredInquiry | null> {
  const current = await getInquiry(inquiryId);
  if (!current) return null;
  return saveInquiry({ ...current, ...patch });
}

export type DeskModeStatus = {
  empty: boolean;
  demo: boolean;
  mode: "demo" | "live";
  connected: boolean;
  store: "supabase" | "memory";
  count: number;
};

export async function deskStatus(): Promise<DeskModeStatus> {
  const [o, p, i] = await Promise.all([listOrders(), listProducts(), listInquiries()]);
  return {
    empty: o.length === 0 && p.length === 0,
    demo: currentDeskMode() === "demo",
    mode: currentDeskMode(),
    connected: shopifyConnected(),
    store: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "memory",
    count: o.length + p.length + i.length,
  };
}

export async function loadDemoCatalog(): Promise<DeskModeStatus> {
  await ensureDeskMode();
  if (currentDeskMode() !== "demo") {
    throw new Error("Demo data is only available before Shopify is connected.");
  }
  seeded = false;
  seeding = null;
  await applyDemoCatalog();
  return deskStatus();
}

/**
 * Scores + upserts a single order (fraud heuristic/Claude re-run every time,
 * same as the bulk sync path) — shared by syncShopifyLive's loop and the
 * live webhook handler, which ingests one order per call.
 */
export async function upsertOrderFromInput(input: OrderInput): Promise<StoredOrder> {
  await seedIfNeeded();
  const scored = await runFraudScoring(input);
  const existing = [...orders.values()].find((o) => o.shopifyOrderId === input.shopifyOrderId);
  const order: StoredOrder = {
    ...(existing ?? { id: id("order", input.shopifyOrderId) }),
    ...input,
    ...scored,
    id: existing?.id ?? id("order", input.shopifyOrderId),
  };
  orders.set(order.id, order);
  await supabaseUpsertOrder(order);
  return order;
}

export async function syncShopifyLive(): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getLiveShopifyClient();
  if (!client) {
    return { ok: false, error: "SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN required. Paste them in Settings." };
  }
  await seedIfNeeded();
  const [orderInputs, productInputs] = await Promise.all([client.fetchOrders(), client.fetchProducts()]);
  for (const input of orderInputs) {
    await upsertOrderFromInput(input);
  }
  for (const input of productInputs) {
    const predicted = await runInventoryPrediction(input);
    const existing = [...products.values()].find((p) => p.shopifyProductId === input.shopifyProductId);
    const product: StoredProduct = {
      ...(existing ?? { id: id("product", input.shopifyProductId) }),
      ...input,
      ...predicted,
      id: existing?.id ?? id("product", input.shopifyProductId),
    };
    products.set(product.id, product);
    await supabaseUpsertProduct(product);
  }
  seeded = true;
  return { ok: true };
}

export async function clearDesk(): Promise<DeskModeStatus> {
  orders.clear();
  products.clear();
  inquiries.clear();
  seeded = true;
  seeding = null;
  return deskStatus();
}
