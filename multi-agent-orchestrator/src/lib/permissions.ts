import type { AgentId, PermissionKey, PermissionMap } from "./types";

export const AGENT_CATALOG: {
  id: AgentId;
  name: string;
  short: string;
  role: string;
  detail: string;
  accent: string;
  icon: string;
}[] = [
  {
    id: "orchestrator",
    name: "Orquestador",
    short: "ORCH",
    role: "Clasifica el input, arma el flujo y consolida el resultado.",
    detail:
      "Clasifica el input como url, article o copy, decide si autoriza el fetch de una URL, ordena el grafo (extractor → SEO ∥ verificación → revisor → recomendador → revisor → consolidar) y calcula la confianza global al final de la corrida.",
    accent: "cyan",
    icon: "memory",
  },
  {
    id: "extractor",
    name: "Extractor",
    short: "EXT",
    role: "Campos con evidencia y confidence score.",
    detail:
      "Estructura título, audiencia, keywords, tono y extensión a partir del texto normalizado. Cada campo trae su propio confidence score y una cita textual como evidencia.",
    accent: "sky",
    icon: "save_as",
  },
  {
    id: "seo",
    name: "Calidad / SEO",
    short: "SEO",
    role: "Legibilidad, keywords y huecos de contenido.",
    detail:
      "Corre en paralelo con Verificación. Calcula legibilidad, densidad de palabras y si la keyword principal aparece en el lead; devuelve además una meta description sugerida.",
    accent: "violet",
    icon: "search_insights",
  },
  {
    id: "factcheck",
    name: "Verificación",
    short: "FACT",
    role: "Claims soportadas o sin fuente. No inventa.",
    detail:
      "Separa oraciones con cifras o afirmaciones fuertes y las marca como supported (citan fuente), unverified (sin fuente) o conflicted. Nunca inventa una fuente que no existe en el texto.",
    accent: "amber",
    icon: "fact_check",
  },
  {
    id: "recommender",
    name: "Recomendaciones",
    short: "REC",
    role: "Acciones priorizadas sobre métricas reales.",
    detail:
      "Lee los outputs de extractor, SEO y verificación —nunca calcula sus propios números— y prioriza hasta 5 acciones accionables en alta, media o baja prioridad.",
    accent: "emerald",
    icon: "recommend",
  },
  {
    id: "reviewer",
    name: "Revisor cruzado",
    short: "REV",
    role: "Un agente revisa a otro: aprueba, corrige o bloquea.",
    detail:
      "Corre dos veces: primero sobre extractor, SEO y verificación; luego sobre el recomendador. Emite approve, revise o block por cada agente que evalúa (agent-reviewing-agent).",
    accent: "rose",
    icon: "rule",
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
