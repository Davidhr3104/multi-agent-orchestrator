import type { AgentId, PermissionKey, PermissionMap } from "./types";

export const AGENT_CATALOG: {
  id: AgentId;
  name: string;
  short: string;
  role: string;
  accent: string;
}[] = [
  {
    id: "orchestrator",
    name: "Orquestador",
    short: "ORCH",
    role: "Clasifica el input, arma el flujo y consolida el resultado.",
    accent: "cyan",
  },
  {
    id: "extractor",
    name: "Extractor",
    short: "EXT",
    role: "Campos con evidencia y confidence score.",
    accent: "sky",
  },
  {
    id: "seo",
    name: "Calidad / SEO",
    short: "SEO",
    role: "Legibilidad, keywords y huecos de contenido.",
    accent: "violet",
  },
  {
    id: "factcheck",
    name: "Verificación",
    short: "FACT",
    role: "Claims soportadas o sin fuente. No inventa.",
    accent: "amber",
  },
  {
    id: "recommender",
    name: "Recomendaciones",
    short: "REC",
    role: "Acciones priorizadas sobre métricas reales.",
    accent: "emerald",
  },
  {
    id: "reviewer",
    name: "Revisor cruzado",
    short: "REV",
    role: "Un agente revisa a otro: aprueba, corrige o bloquea.",
    accent: "rose",
  },
];

export const DEFAULT_PERMISSIONS: PermissionMap = {
  orchestrator: ["read_input", "fetch_url", "request_human", "peer_review"],
  extractor: ["read_input", "write_structured"],
  seo: ["read_input", "analyze_seo"],
  factcheck: ["read_input", "verify_claims"],
  recommender: ["read_input", "write_recommendations"],
  reviewer: ["read_input", "peer_review", "request_human"],
};

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  read_input: "Leer input",
  fetch_url: "Fetch de URL",
  write_structured: "Escribir campos",
  analyze_seo: "Analizar SEO",
  verify_claims: "Verificar hechos",
  write_recommendations: "Escribir recomendaciones",
  peer_review: "Revisión entre agentes",
  request_human: "Escalar a humano",
};

export function can(
  permissions: PermissionMap,
  agent: AgentId,
  key: PermissionKey
): boolean {
  return permissions[agent]?.includes(key) ?? false;
}
