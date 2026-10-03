export type UsageSnapshot = {
  ingestCount: number;
  heuristicCalls: number;
  claudeCalls: number;
  ghlCalls: number;
  hubspotCalls: number;
};

const usage: UsageSnapshot = {
  ingestCount: 0,
  heuristicCalls: 0,
  claudeCalls: 0,
  ghlCalls: 0,
  hubspotCalls: 0,
};

export function getUsage(): UsageSnapshot {
  return { ...usage };
}

export function bumpUsage(kind: "heuristic" | "claude" | "ghl" | "hubspot") {
  if (kind === "heuristic") {
    usage.ingestCount += 1;
    usage.heuristicCalls += 1;
  }
  if (kind === "claude") {
    usage.ingestCount += 1;
    usage.claudeCalls += 1;
  }
  if (kind === "ghl") usage.ghlCalls += 1;
  if (kind === "hubspot") usage.hubspotCalls += 1;
}
