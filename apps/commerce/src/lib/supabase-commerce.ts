import { createClient } from "@supabase/supabase-js";
import type { StoredInquiry, StoredOrder, StoredProduct } from "@helix/core";

type Client = ReturnType<typeof createClient>;

let cached: Client | null | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  );
}

export function getSupabase(): Client | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

type TableQuery = {
  select: (cols: string) => {
    order: (
      col: string,
      opts: { ascending: boolean }
    ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  };
  upsert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
};

function table(db: Client, name: string): TableQuery {
  return (db as unknown as { schema: (name: string) => { from: (table: string) => TableQuery } })
    .schema("commerce")
    .from(name);
}

function orderToRow(order: StoredOrder) {
  return {
    id: order.id,
    shopify_order_id: order.shopifyOrderId,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    total_price: order.totalPrice,
    currency: order.currency,
    financial_status: order.financialStatus,
    fulfillment_status: order.fulfillmentStatus,
    items: order.items,
    shipping_address: order.shippingAddress,
    customer_order_count: order.customerOrderCount,
    created_at: order.createdAt,
    fraud_score: order.fraudScore,
    fraud_reasoning: order.fraudReasoning,
    risk_level: order.riskLevel,
    requires_review: order.requiresReview,
    engine: order.engine,
    demo_mode: order.demoMode,
    reviewed_by: order.reviewedBy ?? null,
    reviewed_at: order.reviewedAt ?? null,
    review_decision: order.reviewDecision ?? null,
  };
}

function orderFromRow(row: Record<string, unknown>): StoredOrder {
  return {
    id: String(row.id),
    shopifyOrderId: String(row.shopify_order_id ?? ""),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    totalPrice: Number(row.total_price),
    currency: String(row.currency ?? "USD"),
    financialStatus: String(row.financial_status),
    fulfillmentStatus: String(row.fulfillment_status),
    items: (row.items as StoredOrder["items"]) ?? [],
    shippingAddress: (row.shipping_address as StoredOrder["shippingAddress"]) ?? {},
    customerOrderCount: Number(row.customer_order_count ?? 0),
    createdAt: String(row.created_at),
    fraudScore: Number(row.fraud_score),
    fraudReasoning: String(row.fraud_reasoning ?? ""),
    riskLevel: row.risk_level as StoredOrder["riskLevel"],
    requiresReview: Boolean(row.requires_review),
    engine: row.engine === "claude" ? "claude" : "heuristic",
    demoMode: Boolean(row.demo_mode),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    reviewDecision: row.review_decision as StoredOrder["reviewDecision"],
  };
}

function productToRow(product: StoredProduct) {
  return {
    id: product.id,
    shopify_product_id: product.shopifyProductId,
    title: product.title,
    sku: product.sku,
    current_inventory: product.currentInventory,
    reorder_point: product.reorderPoint,
    price: product.price,
    image_url: product.imageUrl ?? null,
    sales_velocity: product.salesVelocity,
    predicted_stockout_days: product.predictedStockoutDays,
    restock_recommended: product.restockRecommended,
    reasoning: product.reasoning,
    engine: product.engine,
    demo_mode: product.demoMode,
  };
}

function productFromRow(row: Record<string, unknown>): StoredProduct {
  return {
    id: String(row.id),
    shopifyProductId: String(row.shopify_product_id ?? ""),
    title: String(row.title),
    sku: String(row.sku),
    currentInventory: Number(row.current_inventory),
    reorderPoint: Number(row.reorder_point),
    price: Number(row.price),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    salesVelocity: Number(row.sales_velocity),
    predictedStockoutDays: Number(row.predicted_stockout_days),
    restockRecommended: Boolean(row.restock_recommended),
    reasoning: String(row.reasoning ?? ""),
    engine: row.engine === "claude" ? "claude" : "heuristic",
    demoMode: Boolean(row.demo_mode),
  };
}

function inquiryToRow(inquiry: StoredInquiry) {
  return {
    id: inquiry.id,
    created_at: inquiry.createdAt,
    customer_email: inquiry.customerEmail,
    inquiry_text: inquiry.inquiryText,
    inquiry_type: inquiry.inquiryType,
    sentiment: inquiry.sentiment,
    ai_response: inquiry.aiResponse,
    requires_human: inquiry.requiresHuman,
    status: inquiry.status,
    engine: inquiry.engine,
    demo_mode: inquiry.demoMode,
  };
}

function inquiryFromRow(row: Record<string, unknown>): StoredInquiry {
  return {
    id: String(row.id),
    createdAt: String(row.created_at),
    customerEmail: String(row.customer_email),
    inquiryText: String(row.inquiry_text),
    inquiryType: row.inquiry_type as StoredInquiry["inquiryType"],
    sentiment: row.sentiment as StoredInquiry["sentiment"],
    aiResponse: String(row.ai_response ?? ""),
    requiresHuman: Boolean(row.requires_human),
    status: (row.status as StoredInquiry["status"]) ?? "pending",
    engine: row.engine === "claude" ? "claude" : "heuristic",
    demoMode: Boolean(row.demo_mode),
  };
}

async function listAll<T>(
  tableName: string,
  fromRow: (row: Record<string, unknown>) => T
): Promise<T[] | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await table(db, tableName).select("*").order("created_at", {
    ascending: false,
  });
  if (error) {
    console.warn(`[helix-commerce] list ${tableName} skipped:`, error.message);
    return null;
  }
  return (data ?? []).map((row) => fromRow(row as Record<string, unknown>));
}

async function upsertOne(
  tableName: string,
  row: Record<string, unknown>
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await table(db, tableName).upsert(row);
  if (error) {
    console.warn(`[helix-commerce] upsert ${tableName} skipped:`, error.message);
    return false;
  }
  return true;
}

export const supabaseListOrders = () => listAll("orders", orderFromRow);
export const supabaseUpsertOrder = (order: StoredOrder) => upsertOne("orders", orderToRow(order));

export const supabaseListProducts = () => listAll("products", productFromRow);
export const supabaseUpsertProduct = (product: StoredProduct) =>
  upsertOne("products", productToRow(product));

export const supabaseListInquiries = () => listAll("inquiries", inquiryFromRow);
export const supabaseUpsertInquiry = (inquiry: StoredInquiry) =>
  upsertOne("inquiries", inquiryToRow(inquiry));

export async function supabaseGetThemePreference(): Promise<"light" | "dark" | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await (
    db as unknown as {
      schema: (name: string) => {
        from: (t: string) => {
          select: (
            cols: string
          ) => {
            eq: (
              col: string,
              val: string
            ) => {
              maybeSingle: () => Promise<{
                data: { theme?: string } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    }
  )
    .schema("commerce")
    .from("user_preferences")
    .select("theme")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    console.warn("[helix-commerce] get theme preference skipped:", error.message);
    return null;
  }
  return data?.theme === "light" ? "light" : data?.theme === "dark" ? "dark" : null;
}

export const supabaseSetThemePreference = (theme: "light" | "dark") =>
  upsertOne("user_preferences", { id: "default", theme, updated_at: new Date().toISOString() });
