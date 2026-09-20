import {
  autoSeedEnabled,
  runFraudScoring,
  runInquiryClassification,
  runInventoryPrediction,
  type InquiryInput,
  type StoredInquiry,
  type StoredOrder,
  type StoredProduct,
} from "@helix/core";
import { getMockShopifyClient, getLiveShopifyClient } from "./shopify";
import {
  supabaseListInquiries,
  supabaseListOrders,
  supabaseListProducts,
  supabaseUpsertInquiry,
  supabaseUpsertOrder,
  supabaseUpsertProduct,
} from "./supabase-commerce";

const orders = new Map<string, StoredOrder>();
const products = new Map<string, StoredProduct>();
const inquiries = new Map<string, StoredInquiry>();
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

async function seedIfNeeded(): Promise<void> {
  if (seeded) return;
  if (seeding) return seeding;
  if (!autoSeedEnabled()) {
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
  store: "supabase" | "memory";
  count: number;
};

export async function deskStatus(): Promise<DeskModeStatus> {
  const [o, p, i] = await Promise.all([listOrders(), listProducts(), listInquiries()]);
  return {
    empty: o.length === 0 && p.length === 0,
    demo: o.some((ord) => ord.shopifyOrderId.includes("gid://shopify/Order/1001")),
    store: process.env.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "memory",
    count: o.length + p.length + i.length,
  };
}

export async function loadDemoCatalog(): Promise<DeskModeStatus> {
  seeded = false;
  seeding = null;
  await applyDemoCatalog();
  return deskStatus();
}

export async function syncShopifyLive(): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getLiveShopifyClient();
  if (!client) {
    return { ok: false, error: "SHOPIFY_STORE_DOMAIN and SHOPIFY_ACCESS_TOKEN required. Paste them in Settings." };
  }
  await seedIfNeeded();
  const [orderInputs, productInputs] = await Promise.all([client.fetchOrders(), client.fetchProducts()]);
  for (const input of orderInputs) {
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
