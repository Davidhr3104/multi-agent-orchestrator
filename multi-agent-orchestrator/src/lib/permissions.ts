import type { AgentId, PermissionKey, PermissionMap } from "./types";

export const AGENT_CATALOG: {
  id: AgentId;
  name: string;
  role: string;
}[] = [
  {
    id: "orchestrator",
    name: "Orquestador",
    role: "Clasifica el input, arma el flujo y consolida el resultado final.",
  },
  {
    id: "extractor",
    name: "Extractor",
    role: "Estructura campos con evidencia y confidence score (mismo patrón que el Extraction Agent).",
  },
  {
    id: "seo",
    name: "Calidad / SEO",
    role: "Evalúa legibilidad, keywords y huecos de contenido.",
  },
  {
    id: "factcheck",
    name: "Verificación",
    role: "Separa afirmaciones y las marca como soportadas o sin fuente (estilo RAG: no inventa).",
  },
  {
    id: "recommender",
    name: "Recomendaciones",
    role: "Propone acciones priorizadas a partir de los otros agentes (estilo Hermes).",
  },
  {
    id: "reviewer",
    name: "Revisor cruzado",
    role: "Un agente revisa a otro: aprueba, pide corrección o bloquea.",
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
