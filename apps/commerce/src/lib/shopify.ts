import type { OrderInput, ProductInput } from "@helix/core";

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
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_ACCESS_TOKEN);
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

export function getShopifyClient(): ShopifyClient {
  // Real Admin API implementation is wired here once SHOPIFY_STORE_DOMAIN /
  // SHOPIFY_ACCESS_TOKEN are configured — isShopifyConfigured() gates that swap.
  return new MockShopifyClient();
}
