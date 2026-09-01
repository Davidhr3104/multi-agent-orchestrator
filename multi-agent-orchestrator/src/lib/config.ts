import type { AgentEnabledMap, AgentId, PermissionMap } from "./types";
import { DEFAULT_PERMISSIONS } from "./permissions";

export const DEFAULT_MIN_CONFIDENCE = 0.7;
export const DEFAULT_HITL_THRESHOLD = 0.85;

export const DEFAULT_ENABLED_AGENTS: AgentEnabledMap = {
  orchestrator: true,
  extractor: true,
  seo: true,
  factcheck: true,
  recommender: true,
  reviewer: true,
};

export function isAgentOn(
  enabled: AgentEnabledMap | undefined,
  agent: AgentId
): boolean {
  if (!enabled) return true;
  return enabled[agent] !== false;
}

export function withDefaultRequest(partial: {
  text?: string;
  url?: string;
  permissions?: PermissionMap;
  enabledAgents?: AgentEnabledMap;
  minConfidence?: number;
  hitlThreshold?: number;
}) {
  return {
    text: partial.text,
    url: partial.url,
    permissions: partial.permissions ?? DEFAULT_PERMISSIONS,
    enabledAgents: { ...DEFAULT_ENABLED_AGENTS, ...partial.enabledAgents },
    minConfidence: clamp01(partial.minConfidence ?? DEFAULT_MIN_CONFIDENCE),
    hitlThreshold: clamp01(partial.hitlThreshold ?? DEFAULT_HITL_THRESHOLD),
  };
}

export function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
