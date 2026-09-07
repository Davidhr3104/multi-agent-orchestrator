import type { InventoryPredictionResult, ProductInput } from "./types";

const RESTOCK_LEAD_DAYS = 14;

export function predictInventoryHeuristic(input: ProductInput): InventoryPredictionResult {
  if (input.currentInventory <= 0) {
    return {
      predictedStockoutDays: 0,
      restockRecommended: true,
      reasoning: `${input.title} is already out of stock (0 units).`,
      engine: "heuristic",
      demoMode: true,
    };
  }

  const belowReorderPoint = input.currentInventory <= input.reorderPoint;

  if (input.salesVelocity <= 0) {
    return {
      predictedStockoutDays: 999,
      restockRecommended: belowReorderPoint,
      reasoning: belowReorderPoint
        ? `${input.title} has no recent sales velocity but inventory (${input.currentInventory}) is at or below the reorder point (${input.reorderPoint}).`
        : `${input.title} has no recent sales velocity; no stockout projected.`,
      engine: "heuristic",
      demoMode: true,
    };
  }

  const predictedStockoutDays = Math.floor(input.currentInventory / input.salesVelocity);
  const restockRecommended = predictedStockoutDays <= RESTOCK_LEAD_DAYS || belowReorderPoint;

  const reasoning = restockRecommended
    ? `${input.title}: ${input.currentInventory} units at ${input.salesVelocity}/day sells out in ~${predictedStockoutDays} days (reorder point ${input.reorderPoint}).`
    : `${input.title}: ${input.currentInventory} units at ${input.salesVelocity}/day covers ~${predictedStockoutDays} days, above the ${RESTOCK_LEAD_DAYS}-day lead time.`;

  return {
    predictedStockoutDays,
    restockRecommended,
    reasoning,
    engine: "heuristic",
    demoMode: true,
  };
}
