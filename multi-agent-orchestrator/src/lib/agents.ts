import { can } from "./permissions";
import {
  avgSentenceLength,
  keywords,
  sentences,
  snippet,
  words,
} from "./text";
import type {
  AgentId,
  AgentRun,
  AnalyzeRequest,
  Claim,
  InputKind,
  PipelineLog,
  PipelineResult,
  Recommendation,
  ReviewNote,
  ScoredField,
  StreamEvent,
} from "./types";

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

function clamp(n: number): number {
  return Math.max(0.15, Math.min(0.98, Math.round(n * 100) / 100));
}

async function fetchUrl(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "HelixOrchestrator/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`No se pudo leer la URL (${res.status}).`);
  const html = await res.text();
  const { stripHtml } = await import("./text");
  const text = stripHtml(html);
  if (text.length < 40) throw new Error("La URL no devolvió texto usable.");
  return text.slice(0, 20_000);
}

function classify(text: string, url?: string): InputKind {
  if (url) return "url";
  if (text.trim().length < 280) return "copy";
  return "article";
}

function extractFields(text: string, kind: InputKind): ScoredField[] {
  const sents = sentences(text);
  const title = sents[0] ?? snippet(text, 80);
  const keys = keywords(text);
  const wc = words(text).length;
  const tone =
    (text.match(/!/g)?.length ?? 0) > 2
      ? "promocional"
      : avgSentenceLength(text) > 24
        ? "formal / denso"
        : "claro / directo";

  const titleConf = title.length > 20 && title.length < 140 ? 0.86 : 0.62;
  const kwConf = keys.length >= 4 ? 0.81 : 0.58;
  const audience =
    kind === "copy"
      ? "visitante de landing / decisor rápido"
      : /api|agent|stack|typescript|supabase/i.test(text)
        ? "perfil técnico / hiring manager"
        : "audiencia general de contenido";

  return [
    {
      key: "title",
      label: "Título inferido",
      value: snippet(title, 110),
      confidence: clamp(titleConf),
      evidence: snippet(sents[0] ?? text, 160),
      needsHuman: titleConf < 0.7,
    },
    {
      key: "audience",
      label: "Audiencia",
      value: audience,
      confidence: clamp(kind === "copy" ? 0.74 : 0.69),
      evidence:
        kind === "copy"
          ? "Texto corto: se trata como copy de conversión."
          : snippet(text, 120),
      needsHuman: true,
    },
    {
      key: "keywords",
      label: "Keywords",
      value: keys.join(", ") || "sin señal suficiente",
      confidence: clamp(kwConf),
      evidence: keys.length
        ? `Frecuencia de términos: ${keys.slice(0, 4).join(", ")}.`
        : "Pocas palabras distintivas tras filtrar stopwords.",
      needsHuman: kwConf < 0.7,
    },
    {
      key: "tone",
      label: "Tono",
      value: tone,
      confidence: 0.77,
      evidence: `Longitud media de frase: ${avgSentenceLength(text)} palabras. Total: ${wc} palabras.`,
      needsHuman: false,
    },
    {
      key: "word_count",
      label: "Extensión",
      value: `${wc} palabras · ${sents.length} oraciones`,
      confidence: 0.95,
      evidence: "Conteo determinístico sobre el texto normalizado.",
      needsHuman: false,
    },
  ];
}

function seoAnalysis(text: string, fields: ScoredField[]): {
  summary: string;
  confidence: number;
  extras: ScoredField[];
} {
  const wc = words(text).length;
  const avg = avgSentenceLength(text);
  const keys = (fields.find((f) => f.key === "keywords")?.value ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const first = text.slice(0, 220).toLowerCase();
  const keywordInLead = keys.some((k) => first.includes(k.toLowerCase()));
  const issues: string[] = [];
  if (wc < 300) issues.push("poca profundidad (<300 palabras)");
  if (avg > 26) issues.push("frases largas (legibilidad)");
  if (!keywordInLead && keys.length) issues.push("keyword principal no aparece al inicio");
  if (!/^[#]|h1/i.test(text) && fields[0]?.value.length > 90)
    issues.push("título débil o demasiado largo");

  const score = clamp(
    0.9 - issues.length * 0.12 - (wc < 200 ? 0.1 : 0) + (keywordInLead ? 0.05 : 0)
  );

  return {
    summary:
      issues.length === 0
        ? "SEO estructural sólido: lead claro y densidad razonable."
        : `Hallazgos: ${issues.join("; ")}.`,
    confidence: score,
    extras: [
      {
        key: "meta",
        label: "Meta description sugerida",
        value: snippet(sentences(text).slice(0, 2).join(" "), 155),
        confidence: clamp(sentences(text).length ? 0.72 : 0.4),
        evidence: "Primeras oraciones del documento, recortadas a ~155 caracteres.",
        needsHuman: true,
      },
      {
        key: "readability",
        label: "Legibilidad",
        value: avg <= 18 ? "alta" : avg <= 24 ? "media" : "baja",
        confidence: 0.8,
        evidence: `Promedio ${avg} palabras/oración.`,
        needsHuman: false,
      },
    ],
  };
}

function factCheck(text: string): { claims: Claim[]; confidence: number } {
  const sents = sentences(text);
  const picked = sents.filter((s) =>
    /\d|%|siempre|nunca|always|never|primero|único|garantiza|increase|reduce|\$/i.test(
      s
    )
  );
  const pool = (picked.length ? picked : sents).slice(0, 5);
  const claims: Claim[] = pool.map((s) => {
    const hasNumber = /\d/.test(s);
    const hasHedge = /puede|podría|aprox|cerca|around|might|may/i.test(s);
    const hasSource = /según|source|http|estudio|report/i.test(s);
    let status: Claim["status"] = "unverified";
    let confidence = 0.48;
    let note = "No hay cita en el texto. El agente no inventa una fuente.";
    if (hasSource) {
      status = "supported";
      confidence = 0.78;
      note = "La oración apunta a una fuente o atribución explícita.";
    } else if (hasNumber && !hasHedge) {
      status = "unverified";
      confidence = 0.41;
      note = "Cifra absoluta sin evidencia adjunta → baja confianza.";
    } else if (hasHedge) {
      status = "unverified";
      confidence = 0.55;
      note = "Afirmación matizada; aún requiere fuente si se publica.";
    }
    return { text: snippet(s, 220), status, confidence: clamp(confidence), note };
  });

  const avg =
    claims.reduce((n, c) => n + c.confidence, 0) / Math.max(claims.length, 1);
  return { claims, confidence: clamp(avg) };
}

function recommend(
  kind: InputKind,
  fields: ScoredField[],
  seoSummary: string,
  claims: Claim[]
): Recommendation[] {
  const recs: Recommendation[] = [];
  const weak = fields.filter((f) => f.confidence < 0.7);
  if (weak.length) {
    recs.push({
      title: "Revisar campos de baja confianza",
      detail: `Human-in-the-loop: ${weak.map((w) => w.label).join(", ")}. No publiques estos valores sin confirmar evidencia.`,
      priority: "alta",
      confidence: 0.9,
    });
  }
  if (seoSummary.includes("Hallazgos")) {
    recs.push({
      title: "Cerrar gaps de SEO/calidad",
      detail: seoSummary,
      priority: kind === "copy" ? "media" : "alta",
      confidence: 0.76,
    });
  }
  const unverified = claims.filter((c) => c.status !== "supported");
  if (unverified.length) {
    recs.push({
      title: "Añadir fuentes a afirmaciones",
      detail: `${unverified.length} claim(s) sin soporte. Patrón RAG: reportar “no encontrado” antes que alucinar.`,
      priority: "alta",
      confidence: 0.84,
    });
  }
  recs.push({
    title: kind === "copy" ? "A/B del hook en las primeras 12 palabras" : "Subtítulos H2 por keyword",
    detail:
      kind === "copy"
        ? "El extractor trató esto como copy corto: prueba un hook con cifra o dolor concreto."
        : "Usa las keywords extraídas como H2 y cita evidencia debajo de cada una.",
    priority: "media",
    confidence: 0.7,
  });
  recs.push({
    title: "Dejar log de decisión en el brief",
    detail:
      "Igual que el MCP assistant del portafolio: cada cambio futuro debe quedar auditado (quién, por qué, evidencia).",
    priority: "baja",
    confidence: 0.88,
  });
  return recs.slice(0, 5);
}

function reviewAgents(input: {
  extractorOk: boolean;
  seoSkipped: boolean;
  factsSkipped: boolean;
  fields: ScoredField[];
  claims: Claim[];
  recs: Recommendation[];
}): ReviewNote[] {
  const notes: ReviewNote[] = [];
  const empty = input.fields.some((f) => !f.value || f.confidence < 0.4);
  notes.push({
    targetAgent: "extractor",
    verdict: empty ? "revise" : "approve",
    comment: empty
      ? "Hay campos vacíos o con confianza < 0.40. Pedir humano antes de consolidar."
      : "Estructura coherente: cada campo trae evidencia. Se aprueba con matices de audiencia.",
  });
  notes.push({
    targetAgent: "seo",
    verdict: input.seoSkipped ? "block" : "approve",
    comment: input.seoSkipped
      ? "SEO bloqueado por permisos. El orquestador no debe fingir un score."
      : "Revisión: las métricas salen de heurísticas determinísticas, no de un cálculo inventado.",
  });
  notes.push({
    targetAgent: "factcheck",
    verdict: input.factsSkipped
      ? "block"
      : input.claims.some((c) => c.status === "conflicted")
        ? "revise"
        : "approve",
    comment: input.factsSkipped
      ? "Verificación deshabilitada. Las claims no se marcan como verdaderas."
      : "Buen patrón: las cifras sin fuente quedan unverified en lugar de ‘confirmadas’.",
  });
  notes.push({
    targetAgent: "recommender",
    verdict: input.recs.length ? "approve" : "revise",
    comment: input.recs.length
      ? "Las recomendaciones citan outputs previos (SEO + claims + HITL). Aprobado."
      : "No hay acciones. El revisor pide regenerar.",
  });
  return notes;
}

export async function runPipeline(
  req: AnalyzeRequest,
  emit: (event: StreamEvent) => void
): Promise<PipelineResult> {
  const agents: AgentRun[] = [];

  const log = (agent: AgentId, level: PipelineLog["level"], message: string) => {
    const entry: PipelineLog = { id: id("log"), ts: now(), agent, level, message };
    emit({ type: "log", log: entry });
  };

  const setAgent = (run: AgentRun) => {
    const i = agents.findIndex((a) => a.agent === run.agent);
    if (i >= 0) agents[i] = run;
    else agents.push(run);
    emit({ type: "agent", run });
  };

  const perms = req.permissions;
  const sourceUrl = req.url?.trim() || undefined;
  let text = (req.text ?? "").trim();

  log("orchestrator", "decision", "Clasificando input y armando el grafo de agentes.");

  if (!text && sourceUrl && can(perms, "orchestrator", "fetch_url")) {
    setAgent({
      agent: "orchestrator",
      status: "running",
      summary: "Fetch de URL",
      confidence: 0,
    });
    log("orchestrator", "info", `Fetch autorizado: ${sourceUrl}`);
    text = await fetchUrl(sourceUrl);
  } else if (!text && sourceUrl && !can(perms, "orchestrator", "fetch_url")) {
    log("orchestrator", "warn", "URL recibida pero fetch_url está denegado.");
    throw new Error("Permiso fetch_url denegado para el orquestador.");
  }

  if (!text) throw new Error("Necesitas texto o una URL.");

  const inputKind = classify(text, sourceUrl);
  log(
    "orchestrator",
    "decision",
    `Tipo detectado: ${inputKind}. Flujo: extractor → (seo ∥ factcheck) → reviewer → recommender → reviewer → consolidate.`
  );
  setAgent({
    agent: "orchestrator",
    status: "running",
    summary: `Flujo ${inputKind}`,
    confidence: 0.8,
  });

  // Extractor
  if (!can(perms, "extractor", "read_input") || !can(perms, "extractor", "write_structured")) {
    setAgent({
      agent: "extractor",
      status: "blocked",
      summary: "Sin permiso read_input / write_structured",
      confidence: 0,
    });
    log("extractor", "error", "Permisos insuficientes. Abortando pipeline.");
    throw new Error("El extractor no tiene permisos para correr.");
  }

  setAgent({ agent: "extractor", status: "running", summary: "Estructurando campos", confidence: 0 });
  log("extractor", "info", "Extrayendo campos con evidencia (patrón confidence-scored).");
  await delay(180);
  const fields = extractFields(text, inputKind);
  const extConf =
    fields.reduce((n, f) => n + f.confidence, 0) / Math.max(fields.length, 1);
  setAgent({
    agent: "extractor",
    status: "done",
    summary: `${fields.length} campos · conf. ${extConf.toFixed(2)}`,
    confidence: clamp(extConf),
  });
  log("extractor", "success", `Campos listos. ${fields.filter((f) => f.needsHuman).length} requieren humano.`);

  // Parallel seo + factcheck
  let seoSummary = "SEO omitido por permisos.";
  let seoConf = 0;
  let seoSkipped = true;
  let extras: ScoredField[] = [];

  const seoPromise = (async () => {
    if (!can(perms, "seo", "analyze_seo") || !can(perms, "seo", "read_input")) {
      setAgent({
        agent: "seo",
        status: "skipped",
        summary: "Permiso analyze_seo ausente",
        confidence: 0,
      });
      log("seo", "warn", "Agente SEO saltado: sin analyze_seo.");
      return;
    }
    seoSkipped = false;
    setAgent({ agent: "seo", status: "running", summary: "Analizando calidad", confidence: 0 });
    log("seo", "info", "Corriendo en paralelo con verificación.");
    await delay(220);
    const seo = seoAnalysis(text, fields);
    seoSummary = seo.summary;
    seoConf = seo.confidence;
    extras = seo.extras;
    setAgent({
      agent: "seo",
      status: "done",
      summary: seo.summary,
      confidence: seo.confidence,
    });
    log("seo", "success", seo.summary);
  })();

  let claims: Claim[] = [];
  let factConf = 0;
  let factsSkipped = true;

  const factPromise = (async () => {
    if (!can(perms, "factcheck", "verify_claims") || !can(perms, "factcheck", "read_input")) {
      setAgent({
        agent: "factcheck",
        status: "skipped",
        summary: "Permiso verify_claims ausente",
        confidence: 0,
      });
      log("factcheck", "warn", "Verificación saltada: el sistema no afirmará hechos.");
      return;
    }
    factsSkipped = false;
    setAgent({
      agent: "factcheck",
      status: "running",
      summary: "Separando claims",
      confidence: 0,
    });
    log("factcheck", "info", "Si no hay fuente en el texto → unverified (cero alucinación).");
    await delay(240);
    const fc = factCheck(text);
    claims = fc.claims;
    factConf = fc.confidence;
    setAgent({
      agent: "factcheck",
      status: "done",
      summary: `${claims.length} claims · conf. ${factConf.toFixed(2)}`,
      confidence: factConf,
    });
    log(
      "factcheck",
      "success",
      `${claims.filter((c) => c.status === "supported").length} soportadas, ${claims.filter((c) => c.status === "unverified").length} sin fuente.`
    );
  })();

  await Promise.all([seoPromise, factPromise]);
  fields.push(...extras);

  // Reviewer pass 1
  let reviews: ReviewNote[] = [];
  if (!can(perms, "reviewer", "peer_review")) {
    setAgent({
      agent: "reviewer",
      status: "skipped",
      summary: "peer_review denegado",
      confidence: 0,
    });
    log("reviewer", "warn", "Sin revisión cruzada.");
  } else {
    setAgent({ agent: "reviewer", status: "running", summary: "Revisando agentes", confidence: 0 });
    log("reviewer", "info", "Agent-reviewing-agent: extractor, SEO y factcheck.");
    await delay(160);
    reviews = reviewAgents({
      extractorOk: true,
      seoSkipped,
      factsSkipped,
      fields,
      claims,
      recs: [],
    });
    setAgent({
      agent: "reviewer",
      status: "done",
      summary: reviews.map((r) => `${r.targetAgent}:${r.verdict}`).join(" · "),
      confidence: 0.82,
    });
    for (const r of reviews) {
      log("reviewer", r.verdict === "approve" ? "success" : "warn", `${r.targetAgent}: ${r.verdict} — ${r.comment}`);
    }
  }

  // Recommender
  let recs: Recommendation[] = [];
  if (!can(perms, "recommender", "write_recommendations")) {
    setAgent({
      agent: "recommender",
      status: "skipped",
      summary: "write_recommendations denegado",
      confidence: 0,
    });
    log("recommender", "warn", "Sin recomendaciones.");
  } else {
    setAgent({
      agent: "recommender",
      status: "running",
      summary: "Priorizando acciones",
      confidence: 0,
    });
    log("recommender", "info", "Narrativa sobre métricas ya calculadas (Hermes: el modelo no inventa los números).");
    await delay(180);
    recs = recommend(inputKind, fields, seoSummary, claims);
    const rc = recs.reduce((n, r) => n + r.confidence, 0) / Math.max(recs.length, 1);
    setAgent({
      agent: "recommender",
      status: "done",
      summary: `${recs.length} acciones`,
      confidence: clamp(rc),
    });
    log("recommender", "success", recs.map((r) => r.title).join(" | "));
  }

  if (can(perms, "reviewer", "peer_review") && recs.length) {
    const extra = reviewAgents({
      extractorOk: true,
      seoSkipped,
      factsSkipped,
      fields,
      claims,
      recs,
    }).find((r) => r.targetAgent === "recommender");
    if (extra) {
      reviews = [...reviews.filter((r) => r.targetAgent !== "recommender"), extra];
      log("reviewer", "decision", extra.comment);
      setAgent({
        agent: "reviewer",
        status: "done",
        summary: reviews.map((r) => `${r.targetAgent}:${r.verdict}`).join(" · "),
        confidence: 0.82,
      });
    }
  }

  const confidences = [
    extConf,
    seoSkipped ? null : seoConf,
    factsSkipped ? null : factConf,
  ].filter((n): n is number => n != null);
  const overall = clamp(
    confidences.reduce((a, b) => a + b, 0) / Math.max(confidences.length, 1)
  );
  const humanRequired =
    can(perms, "reviewer", "request_human") &&
    (fields.some((f) => f.needsHuman) || overall < 0.7);

  log(
    "orchestrator",
    "decision",
    `Consolidado. Confianza global ${overall.toFixed(2)}. HITL: ${humanRequired ? "sí" : "no"}.`
  );
  setAgent({
    agent: "orchestrator",
    status: "done",
    summary: `Confianza ${overall.toFixed(2)}`,
    confidence: overall,
  });

  const result: PipelineResult = {
    inputKind,
    sourceText: text,
    sourceUrl,
    fields,
    claims,
    recommendations: recs,
    reviews,
    agents,
    overallConfidence: overall,
    humanRequired,
  };
  emit({ type: "result", result });
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
