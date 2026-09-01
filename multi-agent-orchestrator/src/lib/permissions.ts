import type { AgentId, PermissionKey, PermissionMap } from "./types";

export const AGENT_CATALOG: {
  id: AgentId;
  short: string;
  icon: string;
  accent: string;
}[] = [
  { id: "orchestrator", short: "ORCH", icon: "memory", accent: "cyan" },
  { id: "extractor", short: "EXT", icon: "save_as", accent: "sky" },
  { id: "seo", short: "SEO", icon: "search_insights", accent: "violet" },
  { id: "factcheck", short: "FACT", icon: "fact_check", accent: "amber" },
  { id: "recommender", short: "REC", icon: "recommend", accent: "emerald" },
  { id: "reviewer", short: "REV", icon: "rule", accent: "rose" },
];

export const PERMISSION_KEYS: PermissionKey[] = [
  "read_input",
  "fetch_url",
  "write_structured",
  "analyze_seo",
  "verify_claims",
  "write_recommendations",
  "peer_review",
  "request_human",
];

export const DEFAULT_PERMISSIONS: PermissionMap = {
  orchestrator: ["read_input", "fetch_url", "request_human", "peer_review"],
  extractor: ["read_input", "write_structured"],
  seo: ["read_input", "analyze_seo"],
  factcheck: ["read_input", "verify_claims"],
  recommender: ["read_input", "write_recommendations"],
  reviewer: ["read_input", "peer_review", "request_human"],
};

export function can(
  permissions: PermissionMap,
  agent: AgentId,
  key: PermissionKey
): boolean {
  return permissions[agent]?.includes(key) ?? false;
}
