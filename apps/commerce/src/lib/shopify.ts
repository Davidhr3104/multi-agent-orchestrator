import { createHmac, timingSafeEqual } from "node:crypto";
import { getSecret, type OrderInput, type ProductInput } from "@helix/core";

/**
 * Shape mirrors what a real Shopify Admin API client would return, so swapping the mock
 * implementation for a real fetch() against /admin/api/2025-01/orders.json (and /products.json)
 * later is a body-mapping change, not a redesign of the calling code.
 */
export interface ShopifyClient {
  fetchOrders(): Promise<OrderInput[]>;
  fetchProducts(): Promise<ProductInput[]>;
}

export function isShopifyConfigured(): boolean {
  return Boolean(getSecret("SHOPIFY_STORE_DOMAIN") && getSecret("SHOPIFY_ACCESS_TOKEN"));
}

export function isShopifyWebhookConfigured(): boolean {
  return Boolean(getSecret("SHOPIFY_WEBHOOK_SECRET"));
}

/**
 * Verifies Shopify's X-Shopify-Hmac-Sha256 header against the raw request
 * body — the standard Shopify webhook auth: base64(HMAC-SHA256(rawBody,
 * webhookSecret)), compared with a constant-time equality check. rawBody
 * MUST be the exact bytes Shopify sent (read before any JSON.parse), or the
 * signature will never match.
 */
export function verifyShopifyWebhook(rawBody: string, hmacHeader: string | null): boolean {
  const secret = getSecret("SHOPIFY_WEBHOOK_SECRET");
  if (!secret || !hmacHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(hmacHeader);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const MOCK_CUSTOMERS = [
  { name: "Priya Nair", email: "priya.nair@example.com", orderCount: 6 },
  { name: "Marcus Webb", email: "marcus.webb@example.com", orderCount: 1 },
  { name: "Sofia Reyes", email: "sofia.reyes@example.com", orderCount: 0 },
  { name: "Liam O'Connor", email: "liam.oconnor@example.com", orderCount: 3 },
  { name: "New Customer", email: "burner1234@tempmail.example", orderCount: 0 },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

function mockOrders(): OrderInput[] {
  return [
    {
      shopifyOrderId: "gid://shopify/Order/1001",
      customerName: MOCK_CUSTOMERS[0].name,
      customerEmail: MOCK_CUSTOMERS[0].email,
      totalPrice: 64.5,
      currency: "USD",
      financialStatus: "paid",
      fulfillmentStatus: "fulfilled",
      items: [{ title: "Organic Cotton Tee", sku: "TEE-001", quantity: 2, price: 32.25 }],
      shippingAddress: {
        name: MOCK_CUSTOMERS[0].name,
        address1: "48 Harbor View Rd",
        city: "Portland",
        province: "OR",
        country: "US",
        zip: "97201",
      },
      createdAt: daysAgo(1),
      customerOrderCount: MOCK_CUSTOMERS[0].orderCount,
    },
    {
      shopifyOrderId: "gid://shopify/Order/1002",
      customerName: MOCK_CUSTOMERS[1].name,
      customerEmail: MOCK_CUSTOMERS[1].email,
      totalPrice: 189.0,
      currency: "USD",
      financialStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      items: [{ title: "Leather Weekend Bag", sku: "BAG-014", quantity: 1, price: 189.0 }],
      shippingAddress: {
        name: MOCK_CUSTOMERS[1].name,
        address1: "12 Elm St",
        city: "Denver",
        province: "CO",
        country: "US",
        zip: "80202",
      },
      createdAt: daysAgo(2),
      customerOrderCount: MOCK_CUSTOMERS[1].orderCount,
    },
    {
      shopifyOrderId: "gid://shopify/Order/1003",
      customerName: MOCK_CUSTOMERS[2].name,
      customerEmail: MOCK_CUSTOMERS[2].email,
      totalPrice: 2450.0,
      currency: "USD",
      financialStatus: "pending",
      fulfillmentStatus: "unfulfilled",
      items: [
        { title: "Studio Monitor Speakers (Pair)", sku: "AUD-220", quantity: 1, price: 2450.0 },
      ],
      shippingAddress: {
        name: "S. Reyes-Martin",
        address1: "900 Ocean Dr Apt 14",
        city: "Miami",
        province: "FL",
        country: "US",
        zip: "33139",
      },
      createdAt: daysAgo(0),
      customerOrderCount: MOCK_CUSTOMERS[2].orderCount,
    },
    {
      shopifyOrderId: "gid://shopify/Order/1004",
      customerName: MOCK_CUSTOMERS[3].name,
      customerEmail: MOCK_CUSTOMERS[3].email,
      totalPrice: 42.0,
      currency: "USD",
      financialStatus: "paid",
      fulfillmentStatus: "fulfilled",
      items: [{ title: "Ceramic Mug Set", sku: "MUG-003", quantity: 1, price: 42.0 }],
      shippingAddress: {
        name: MOCK_CUSTOMERS[3].name,
        address1: "77 Kildare Ave",
        city: "Chicago",
        province: "IL",
        country: "US",
        zip: "60601",
      },
      createdAt: daysAgo(4),
      customerOrderCount: MOCK_CUSTOMERS[3].orderCount,
    },
    {
      shopifyOrderId: "gid://shopify/Order/1005",
      customerName: MOCK_CUSTOMERS[4].name,
      customerEmail: MOCK_CUSTOMERS[4].email,
      totalPrice: 3120.0,
      currency: "USD",
      financialStatus: "pending",
      fulfillmentStatus: "unfulfilled",
      items: [{ title: "4K Drone Kit", sku: "DRN-500", quantity: 1, price: 3120.0 }],
      shippingAddress: {},
      createdAt: daysAgo(0),
      customerOrderCount: MOCK_CUSTOMERS[4].orderCount,
    },
  ];
}

function mockProducts(): ProductInput[] {
  return [
    {
      shopifyProductId: "gid://shopify/Product/1",
      title: "Organic Cotton Tee",
      sku: "TEE-001",
      currentInventory: 240,
      reorderPoint: 40,
      price: 32.25,
      salesVelocity: 6,
    },
    {
      shopifyProductId: "gid://shopify/Product/2",
      title: "Leather Weekend Bag",
      sku: "BAG-014",
      currentInventory: 18,
      reorderPoint: 10,
      price: 189.0,
      salesVelocity: 1.2,
    },
    {
      shopifyProductId: "gid://shopify/Product/3",
      title: "Studio Monitor Speakers (Pair)",
      sku: "AUD-220",
      currentInventory: 6,
      reorderPoint: 8,
      price: 2450.0,
      salesVelocity: 0.8,
    },
    {
      shopifyProductId: "gid://shopify/Product/4",
      title: "Ceramic Mug Set",
      sku: "MUG-003",
      currentInventory: 85,
      reorderPoint: 25,
      price: 42.0,
      salesVelocity: 3,
    },
    {
      shopifyProductId: "gid://shopify/Product/5",
      title: "4K Drone Kit",
      sku: "DRN-500",
      currentInventory: 2,
      reorderPoint: 5,
      price: 3120.0,
      salesVelocity: 1.5,
    },
    {
      shopifyProductId: "gid://shopify/Product/6",
      title: "Wool Blanket Throw",
      sku: "BLK-090",
      currentInventory: 0,
      reorderPoint: 15,
      price: 78.0,
      salesVelocity: 2.1,
    },
  ];
}

class MockShopifyClient implements ShopifyClient {
  async fetchOrders(): Promise<OrderInput[]> {
    return mockOrders();
  }
  async fetchProducts(): Promise<ProductInput[]> {
    return mockProducts();
  }
}

function shopDomain(): string {
  return getSecret("SHOPIFY_STORE_DOMAIN").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function numericId(gid: string): string {
  const match = gid.match(/(\d+)\s*$/);
  return match ? match[1] : gid.replace(/\D/g, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * Maps one raw Shopify order object (same shape whether it came from
 * GET /orders.json's `orders[]` array or a webhook body for orders/create,
 * orders/updated, fulfillments/update, refunds/create — Shopify sends the
 * full order resource for all of those) into Helix's OrderInput.
 */
export function mapShopifyOrderRow(raw: unknown): OrderInput {
  const order = asRecord(raw) ?? {};
  const customer = asRecord(order.customer) ?? {};
  const shipping = asRecord(order.shipping_address) ?? {};
  const items = Array.isArray(order.line_items) ? order.line_items : [];
  return {
    shopifyOrderId: `gid://shopify/Order/${order.id}`,
    customerName: String(customer.first_name || shipping.name || "Customer"),
    customerEmail: String(order.email || customer.email || ""),
    totalPrice: Number(order.total_price || 0),
    currency: String(order.currency || "USD"),
    financialStatus: String(order.financial_status || ""),
    fulfillmentStatus: String(order.fulfillment_status || "unfulfilled"),
    items: items.map((item) => {
      const row = asRecord(item) ?? {};
      return {
        title: String(row.title || "Item"),
        sku: row.sku != null ? String(row.sku) : undefined,
        quantity: Number(row.quantity || 1),
        price: Number(row.price || 0),
      };
    }),
    shippingAddress: {
      name: shipping.name != null ? String(shipping.name) : undefined,
      address1: shipping.address1 != null ? String(shipping.address1) : undefined,
      city: shipping.city != null ? String(shipping.city) : undefined,
      province: shipping.province != null ? String(shipping.province) : undefined,
      country: shipping.country != null ? String(shipping.country) : undefined,
      zip: shipping.zip != null ? String(shipping.zip) : undefined,
    },
    createdAt: String(order.created_at || new Date().toISOString()),
    customerOrderCount: Number(customer.orders_count || 0),
  };
}

class LiveShopifyClient implements ShopifyWriteClient {
  private async admin(path: string, init?: RequestInit): Promise<Response> {
    const domain = shopDomain();
    const token = getSecret("SHOPIFY_ACCESS_TOKEN");
    return fetch(`https://${domain}/admin/api/2024-10/${path}`, {
      ...init,
      headers: {
        "X-Shopify-Access-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
  }

  async fetchOrders(): Promise<OrderInput[]> {
    const res = await this.admin("orders.json?status=any&limit=50");
    if (!res.ok) throw new Error(`Shopify orders HTTP ${res.status}`);
    const payload = (await res.json()) as { orders?: unknown[] };
    return (payload.orders ?? []).map(mapShopifyOrderRow);
  }

  /**
   * Fetches one order by its numeric Shopify id — used by the webhook
   * handler for topics that don't carry the full order (fulfillments/*,
   * refunds/*), where the payload only has order_id and we need the current
   * order state to re-score/persist it.
   */
  async fetchOrderById(numericOrderId: string): Promise<OrderInput | null> {
    const res = await this.admin(`orders/${numericOrderId}.json`);
    if (!res.ok) return null;
    const payload = (await res.json()) as { order?: unknown };
    if (!payload.order) return null;
    return mapShopifyOrderRow(payload.order);
  }

  async fetchProducts(): Promise<ProductInput[]> {
    const res = await this.admin("products.json?limit=50");
    if (!res.ok) throw new Error(`Shopify products HTTP ${res.status}`);
    const payload = (await res.json()) as { products?: unknown[] };
    return (payload.products ?? []).map((raw) => {
      const product = asRecord(raw) ?? {};
      const variants = Array.isArray(product.variants) ? product.variants : [];
      const variant = asRecord(variants[0]) ?? {};
      return {
        shopifyProductId: `gid://shopify/Product/${product.id}`,
        title: String(product.title || "Product"),
        sku: String(variant.sku || product.id || ""),
        currentInventory: Number(variant.inventory_quantity || 0),
        reorderPoint: 5,
        price: Number(variant.price || 0),
        salesVelocity: 0,
      };
    });
  }

  async fulfillOrder(shopifyOrderId: string): Promise<void> {
    const id = numericId(shopifyOrderId);
    const fo = await this.admin(`orders/${id}/fulfillment_orders.json`);
    if (!fo.ok) throw new Error(`Shopify fulfillment_orders HTTP ${fo.status}`);
    const data = (await fo.json()) as { fulfillment_orders?: Array<{ id?: number; status?: string }> };
    const open = (data.fulfillment_orders ?? []).filter((row) => row.status !== "closed" && row.id);
    if (open.length === 0) {
      const legacy = await this.admin(`orders/${id}/fulfillments.json`, {
        method: "POST",
        body: JSON.stringify({ fulfillment: { notify_customer: false } }),
      });
      if (!legacy.ok) throw new Error(`Shopify fulfill HTTP ${legacy.status}`);
      return;
    }
    const create = await this.admin("fulfillments.json", {
      method: "POST",
      body: JSON.stringify({
        fulfillment: {
          notify_customer: false,
          line_items_by_fulfillment_order: open.map((row) => ({ fulfillment_order_id: row.id })),
        },
      }),
    });
    if (!create.ok) throw new Error(`Shopify fulfill HTTP ${create.status}`);
  }

  async cancelOrder(shopifyOrderId: string): Promise<void> {
    const id = numericId(shopifyOrderId);
    const res = await this.admin(`orders/${id}/cancel.json`, {
      method: "POST",
      body: JSON.stringify({ reason: "other", email: false }),
    });
    if (!res.ok) throw new Error(`Shopify cancel HTTP ${res.status}`);
  }
}

export interface ShopifyWriteClient extends ShopifyClient {
  fulfillOrder(shopifyOrderId: string): Promise<void>;
  cancelOrder(shopifyOrderId: string): Promise<void>;
  fetchOrderById(numericOrderId: string): Promise<OrderInput | null>;
}

export function getMockShopifyClient(): ShopifyClient {
  return new MockShopifyClient();
}

export function getLiveShopifyClient(): ShopifyWriteClient | null {
  if (!isShopifyConfigured()) return null;
  return new LiveShopifyClient();
}

export function getShopifyClient(): ShopifyClient {
  return getLiveShopifyClient() ?? getMockShopifyClient();
}
