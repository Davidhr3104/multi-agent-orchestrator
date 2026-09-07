import { describe, expect, it } from "vitest";
import { predictInventoryHeuristic } from "./inventoryHeuristic";
import type { ProductInput } from "./types";

function baseProduct(overrides: Partial<ProductInput> = {}): ProductInput {
  return {
    shopifyProductId: "gid://shopify/Product/1",
    title: "Classic Tee",
    sku: "TEE-001",
    currentInventory: 100,
    reorderPoint: 20,
    price: 25,
    salesVelocity: 2,
    ...overrides,
  };
}

describe("predictInventoryHeuristic", () => {
  it("does not recommend restock when inventory comfortably covers velocity", () => {
    const result = predictInventoryHeuristic(baseProduct());
    expect(result.restockRecommended).toBe(false);
    expect(result.predictedStockoutDays).toBeGreaterThan(30);
  });

  it("recommends restock when stockout is imminent", () => {
    const result = predictInventoryHeuristic(
      baseProduct({ currentInventory: 10, salesVelocity: 5 })
    );
    expect(result.restockRecommended).toBe(true);
    expect(result.predictedStockoutDays).toBeLessThanOrEqual(7);
  });

  it("recommends restock when inventory is already below reorder point", () => {
    const result = predictInventoryHeuristic(
      baseProduct({ currentInventory: 15, reorderPoint: 20, salesVelocity: 0.5 })
    );
    expect(result.restockRecommended).toBe(true);
  });

  it("handles zero sales velocity without throwing or dividing by zero into Infinity errors", () => {
    const result = predictInventoryHeuristic(
      baseProduct({ salesVelocity: 0, currentInventory: 50, reorderPoint: 20 })
    );
    expect(Number.isFinite(result.predictedStockoutDays)).toBe(true);
    expect(result.restockRecommended).toBe(false);
  });

  it("flags zero inventory as immediate stockout", () => {
    const result = predictInventoryHeuristic(baseProduct({ currentInventory: 0, salesVelocity: 1 }));
    expect(result.predictedStockoutDays).toBe(0);
    expect(result.restockRecommended).toBe(true);
  });
});
