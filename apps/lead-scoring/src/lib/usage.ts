export type UsageSnapshot = {
  ingestCount: number;
  heuristicCalls: number;
  claudeCalls: number;
  ghlCalls: number;
  estimatedTokens: number;
};

let usage: UsageSnapshot = {
  ingestCount: 0,
  heuristicCalls: 0,
  claudeCalls: 0,
  ghlCalls: 0,
  estimatedTokens: 0,
};

export function getUsage(): UsageSnapshot {
  return { ...usage };
}

export function bumpUsage(kind: "heuristic" | "claude" | "ghl") {
  if (kind === "heuristic") {
    usage.ingestCount += 1;
    usage.heuristicCalls += 1;
  }
  if (kind === "claude") {
    usage.ingestCount += 1;
    usage.claudeCalls += 1;
    usage.estimatedTokens += 1200;
  }
  if (kind === "ghl") usage.ghlCalls += 1;
}
