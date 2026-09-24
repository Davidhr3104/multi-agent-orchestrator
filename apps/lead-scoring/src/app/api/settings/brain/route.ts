import { getBrain, setBrain, type BrainAutomations, type BrainGates } from "@/lib/brain";
import type { ScoreThresholds } from "@helix/core";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(getBrain());
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = body as {
    addendum?: string;
    hitl?: number;
    gates?: Partial<BrainGates>;
    automations?: Partial<BrainAutomations>;
    disabledRuleIds?: string[];
    thresholds?: Partial<ScoreThresholds>;
  };
  const current = getBrain();
  return Response.json(
    setBrain({
      addendum: row.addendum,
      hitl: row.hitl,
      gates: row.gates ? { ...current.gates, ...row.gates } : undefined,
      automations: row.automations ? { ...current.automations, ...row.automations } : undefined,
      disabledRuleIds: row.disabledRuleIds,
      thresholds: row.thresholds ? { ...current.thresholds, ...row.thresholds } : undefined,
    })
  );
}
