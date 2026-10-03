/**
 * Admin API access scopes the Commerce code actually calls, kept next to the endpoints that need
 * them. Pure data (no node imports) so the Settings page can render it.
 */
export const SHOPIFY_SCOPES: { scope: string; required: boolean; usedFor: string }[] = [
  { scope: "read_orders", required: true, usedFor: "orders.json, orders/{id}.json, orders/{id}/risks.json, transactions.json — sync, cron poll, fraud explanation, sales velocity" },
  { scope: "write_orders", required: true, usedFor: "orders/{id}/cancel.json and refunds.json — only after a human confirms in Helix" },
  { scope: "read_products", required: true, usedFor: "products.json — catalog and variant inventory_quantity" },
  { scope: "read_customers", required: true, usedFor: "customer.orders_count on each order (account-history signal)" },
  { scope: "read_merchant_managed_fulfillment_orders", required: true, usedFor: "orders/{id}/fulfillment_orders.json before fulfilling an approved order" },
  { scope: "write_merchant_managed_fulfillment_orders", required: true, usedFor: "fulfillments.json — fulfil an order a human approved" },
  { scope: "write_fulfillments", required: false, usedFor: "Optional. Legacy orders/{id}/fulfillments.json fallback, only hit when an order has no open fulfillment order" },
  { scope: "read_inventory", required: false, usedFor: "Optional. Not called today; keeps inventory reads working if Shopify moves stock off the variant payload" },
];

export const SHOPIFY_WEBHOOK_TOPICS = [
  "orders/create",
  "orders/updated",
  "orders/cancelled",
  "fulfillments/create",
  "fulfillments/update",
  "refunds/create",
];
