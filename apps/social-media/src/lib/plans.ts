import type { PlanId } from "./types";

export const PLANS: Record<PlanId, { label: string; credits: number; accounts: number; workspaces: number }> = {
  starter: { label: "Starter", credits: 40, accounts: 2, workspaces: 2 },
  pro: { label: "Pro", credits: 200, accounts: 8, workspaces: 8 },
};
