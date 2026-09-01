import { narrateWithClaude, isClaudeConfigured } from "./claude";
import { isAgentOn } from "./config";
import { can } from "./permissions";
import { isSupabaseConfigured } from "./supabase-logs";
import {
  avgSentenceLength,
  keywords,
  sentences,
  snippet,
  words,
} from "./text";
import type {
  AgentDecision,
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

function decide(
  status: AgentRun["status"],
  confidence: number,
  minConfidence: number,
  hitlThreshold: number
): AgentDecision {
  if (status === "blocked" || status === "skipped") return "bloqueado";
  if (confidence < minConfidence) return "bloqueado";
  if (confidence < hitlThreshold) return "requiere revisión";
  return "aprobado";
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

function markField(
  field: Omit<ScoredField, "needsHuman">,
  hitlThreshold: number
): ScoredField {
  return { ...field, needsHuman: field.confidence < hitlThreshold };
}

function extractFields(
  text: string,
  kind: InputKind,
  hitlThreshold: number
): ScoredField[] {
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
    markField(
      {
        key: "title",
        label: "Título inferido",
        value: snippet(title, 110),
        confidence: clamp(titleConf),
        evidence: snippet(sents[0] ?? text, 160),
      },
      hitlThreshold
    ),
    markField(
      {
        key: "audience",
        label: "Audiencia",
        value: audience,
        confidence: clamp(kind === "copy" ? 0.74 : 0.69),
        evidence:
          kind === "copy"
            ? "Texto corto: se trata como copy de conversión."
            : snippet(text, 120),
      },
      hitlThreshold
    ),
    markField(
      {
        key: "keywords",
        label: "Keywords",
        value: keys.join(", ") || "sin señal suficiente",
        confidence: clamp(kwConf),
        evidence: keys.length
          ? `Frecuencia de términos: ${keys.slice(0, 4).join(", ")}.`
          : "Pocas palabras distintivas tras filtrar stopwords.",
      },
      hitlThreshold
    ),
    markField(
      {
        key: "tone",
        label: "Tono",
        value: tone,
        confidence: 0.77,
        evidence: `Longitud media de frase: ${avgSentenceLength(text)} palabras. Total: ${wc} palabras.`,
      },
      hitlThreshold
    ),
    markField(
      {
        key: "word_count",
        label: "Extensión",
        value: `${wc} palabras · ${sents.length} oraciones`,
        confidence: 0.95,
        evidence: "Conteo determinístico sobre el texto normalizado.",
      },
      hitlThreshold
    ),
  ];
}

function seoAnalysis(
  text: string,
  fields: ScoredField[],
  hitlThreshold: number
): { summary: string; confidence: number; extras: ScoredField[] } {
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
  if (!keywordInLead && keys.length)
    issues.push("keyword principal no aparece al inicio");
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
      markField(
        {
          key: "meta",
          label: "Meta description sugerida",
          value: snippet(sentences(text).slice(0, 2).join(" "), 155),
          confidence: clamp(sentences(text).length ? 0.72 : 0.4),
          evidence:
            "Primeras oraciones del documento, recortadas a ~155 caracteres.",
        },
        hitlThreshold
      ),
      markField(
        {
          key: "readability",
          label: "Legibilidad",
          value: avg <= 18 ? "alta" : avg <= 24 ? "media" : "baja",
          confidence: 0.8,
          evidence: `Promedio ${avg} palabras/oración.`,
        },
        hitlThreshold
      ),
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
  claims: Claim[],
  minConfidence: number
): Recommendation[] {
  const recs: Recommendation[] = [];
  const weak = fields.filter((f) => f.confidence < minConfidence);
  if (weak.length) {
    recs.push({
      title: "Revisar campos de baja confianza",
      detail: `HITL: ${weak.map((w) => w.label).join(", ")}. Umbral mínimo ${minConfidence.toFixed(2)}.`,
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
      detail: `${unverified.length} claim(s) sin soporte. No se inventa fuente.`,
      priority: "alta",
      confidence: 0.84,
    });
  }
  recs.push({
    title:
      kind === "copy"
        ? "A/B del hook en las primeras 12 palabras"
        : "Subtítulos H2 por keyword",
    detail:
      kind === "copy"
        ? "Texto corto: prueba un hook con cifra o dolor concreto."
        : "Usa las keywords extraídas como H2 y cita evidencia debajo.",
    priority: "media",
    confidence: 0.7,
  });
  recs.push({
    title: "Dejar log de decisión en el brief",
    detail: "Cada cambio futuro debe quedar auditado (quién, por qué, evidencia).",
    priority: "baja",
    confidence: 0.88,
  });
  return recs.slice(0, 5);
}

function reviewAgents(input: {
  seoSkipped: boolean;
  factsSkipped: boolean;
  fields: ScoredField[];
  claims: Claim[];
  recs: Recommendation[];
  minConfidence: number;
}): ReviewNote[] {
  const notes: ReviewNote[] = [];
  const empty = input.fields.some(
    (f) => !f.value || f.confidence < input.minConfidence
  );
  notes.push({
    targetAgent: "extractor",
    verdict: empty ? "revise" : "approve",
    comment: empty
      ? `Hay campos bajo el umbral ${input.minConfidence.toFixed(2)}.`
      : "Estructura coherente: cada campo trae evidencia.",
  });
  notes.push({
    targetAgent: "seo",
    verdict: input.seoSkipped ? "block" : "approve",
    comment: input.seoSkipped
      ? "SEO deshabilitado. No se finge un score."
      : "Métricas determinísticas, no inventadas.",
  });
  notes.push({
    targetAgent: "factcheck",
    verdict: input.factsSkipped
      ? "block"
      : input.claims.some((c) => c.status === "conflicted")
        ? "revise"
        : "approve",
    comment: input.factsSkipped
      ? "Verificación deshabilitada."
      : "Cifras sin fuente quedan unverified.",
  });
  notes.push({
    targetAgent: "recommender",
    verdict: input.recs.length ? "approve" : "revise",
    comment: input.recs.length
      ? "Recomendaciones ancladas a outputs previos."
      : "No hay acciones.",
  });
  return notes;
}

export async function runPipeline(
  req: AnalyzeRequest,
  emit: (event: StreamEvent) => void
): Promise<PipelineResult> {
  const startedAt = now();
  const t0 = Date.now();
  const runId = id("run");
  const agents: AgentRun[] = [];
  const collected: PipelineLog[] = [];
  const minConfidence = req.minConfidence;
  const hitlThreshold = req.hitlThreshold;
  const enabled = req.enabledAgents;
  const perms = req.permissions;

  const log = (
    agent: AgentId,
    level: PipelineLog["level"],
    message: string,
    extra?: { field?: string; confidence?: number; evidence?: string }
  ) => {
    const entry: PipelineLog = {
      id: id("log"),
      ts: now(),
      agent,
      level,
      message,
      field: extra?.field,
      confidence: extra?.confidence,
      evidence: extra?.evidence,
    };
    collected.push(entry);
    emit({ type: "log", log: entry });
  };

  const setAgent = (run: AgentRun) => {
    const withDecision: AgentRun = {
      ...run,
      decision: decide(run.status, run.confidence, minConfidence, hitlThreshold),
    };
    const i = agents.findIndex((a) => a.agent === run.agent);
    if (i >= 0) agents[i] = withDecision;
    else agents.push(withDecision);
    emit({ type: "agent", run: withDecision });
  };

  log("orchestrator", "decision", "Pipeline iniciado.", {
    field: "run_id",
    evidence: runId,
    confidence: 1,
  });
  log(
    "orchestrator",
    "info",
    `Umbrales: min ${minConfidence.toFixed(2)} · HITL ${hitlThreshold.toFixed(2)}.`,
    { field: "thresholds", confidence: hitlThreshold }
  );

  if (!isAgentOn(enabled, "orchestrator")) {
    throw new Error("El orquestador está deshabilitado. Actívalo para correr el pipeline.");
  }

  const sourceUrl = req.url?.trim() || undefined;
  let text = (req.text ?? "").trim();

  if (!text && sourceUrl && can(perms, "orchestrator", "fetch_url")) {
    setAgent({
      agent: "orchestrator",
      status: "running",
      summary: "Fetch de URL",
      confidence: 0,
    });
    log("orchestrator", "info", `Fetch autorizado.`, {
      field: "url",
      evidence: sourceUrl,
    });
    text = await fetchUrl(sourceUrl);
    log("orchestrator", "success", "URL convertida a texto.", {
      field: "url",
      confidence: 0.9,
      evidence: snippet(text, 180),
    });
  } else if (!text && sourceUrl) {
    log("orchestrator", "warn", "fetch_url denegado.", { field: "url", evidence: sourceUrl });
    throw new Error("Permiso fetch_url denegado para el orquestador.");
  }

  if (!text) throw new Error("Necesitas texto o una URL.");

  const inputKind = classify(text, sourceUrl);
  log("orchestrator", "decision", `Tipo detectado: ${inputKind}.`, {
    field: "input_kind",
    confidence: 0.88,
    evidence: `Flujo: extractor → (seo ∥ factcheck) → reviewer → recs.`,
  });
  setAgent({
    agent: "orchestrator",
    status: "running",
    summary: `Flujo ${inputKind}`,
    confidence: 0.8,
  });

  const extractorOn =
    isAgentOn(enabled, "extractor") &&
    can(perms, "extractor", "read_input") &&
    can(perms, "extractor", "write_structured");

  if (!extractorOn) {
    setAgent({
      agent: "extractor",
      status: "blocked",
      summary: "Agente o permisos apagados",
      confidence: 0,
    });
    log("extractor", "error", "Extractor bloqueado. Abortando.", {
      field: "extractor",
      confidence: 0,
    });
    throw new Error("El extractor está deshabilitado o sin permisos.");
  }

  setAgent({
    agent: "extractor",
    status: "running",
    summary: "Estructurando campos",
    confidence: 0,
  });
  await delay(120);
  const fields = extractFields(text, inputKind, hitlThreshold);
  for (const field of fields) {
    log("extractor", field.needsHuman ? "warn" : "success", `Campo ${field.label}.`, {
      field: field.key,
      confidence: field.confidence,
      evidence: `${field.value} · ${field.evidence}`,
    });
    await delay(40);
  }
  const extConf =
    fields.reduce((n, f) => n + f.confidence, 0) / Math.max(fields.length, 1);
  setAgent({
    agent: "extractor",
    status: "done",
    summary: `${fields.length} campos · conf. ${extConf.toFixed(2)}`,
    confidence: clamp(extConf),
  });

  let seoSummary = "SEO omitido.";
  let seoSkipped = true;
  let extras: ScoredField[] = [];

  const seoPromise = (async () => {
    const on =
      isAgentOn(enabled, "seo") &&
      can(perms, "seo", "analyze_seo") &&
      can(perms, "seo", "read_input");
    if (!on) {
      setAgent({
        agent: "seo",
        status: "skipped",
        summary: "Agente deshabilitado",
        confidence: 0,
      });
      log("seo", "warn", "SEO saltado.", { field: "seo", confidence: 0 });
      return;
    }
    seoSkipped = false;
    setAgent({
      agent: "seo",
      status: "running",
      summary: "Analizando calidad",
      confidence: 0,
    });
    log("seo", "info", "Corriendo en paralelo con verificación.", {
      field: "seo",
    });
    await delay(180);
    const seo = seoAnalysis(text, fields, hitlThreshold);
    seoSummary = seo.summary;
    extras = seo.extras;
    for (const field of extras) {
      log("seo", field.needsHuman ? "warn" : "success", `Campo ${field.label}.`, {
        field: field.key,
        confidence: field.confidence,
        evidence: `${field.value} · ${field.evidence}`,
      });
    }
    setAgent({
      agent: "seo",
      status: "done",
      summary: seo.summary,
      confidence: seo.confidence,
    });
  })();

  let claims: Claim[] = [];
  let factConf = 0;
  let factsSkipped = true;

  const factPromise = (async () => {
    const on =
      isAgentOn(enabled, "factcheck") &&
      can(perms, "factcheck", "verify_claims") &&
      can(perms, "factcheck", "read_input");
    if (!on) {
      setAgent({
        agent: "factcheck",
        status: "skipped",
        summary: "Agente deshabilitado",
        confidence: 0,
      });
      log("factcheck", "warn", "Verificación saltada.", {
        field: "claims",
        confidence: 0,
      });
      return;
    }
    factsSkipped = false;
    setAgent({
      agent: "factcheck",
      status: "running",
      summary: "Separando claims",
      confidence: 0,
    });
    await delay(200);
    const fc = factCheck(text);
    claims = fc.claims;
    factConf = fc.confidence;
    claims.forEach((claim, i) => {
      log(
        "factcheck",
        claim.status === "supported" ? "success" : "warn",
        `Claim ${i + 1}: ${claim.status}.`,
        {
          field: `claim_${i + 1}`,
          confidence: claim.confidence,
          evidence: `${claim.text} · ${claim.note}`,
        }
      );
    });
    setAgent({
      agent: "factcheck",
      status: "done",
      summary: `${claims.length} claims · conf. ${factConf.toFixed(2)}`,
      confidence: factConf,
    });
  })();

  await Promise.all([seoPromise, factPromise]);
  fields.push(...extras);

  let reviews: ReviewNote[] = [];
  const reviewerOn =
    isAgentOn(enabled, "reviewer") && can(perms, "reviewer", "peer_review");
  if (!reviewerOn) {
    setAgent({
      agent: "reviewer",
      status: "skipped",
      summary: "Agente deshabilitado",
      confidence: 0,
    });
    log("reviewer", "warn", "Revisor saltado.", { field: "reviewer", confidence: 0 });
  } else {
    setAgent({
      agent: "reviewer",
      status: "running",
      summary: "Revisando agentes",
      confidence: 0,
    });
    await delay(120);
    reviews = reviewAgents({
      seoSkipped,
      factsSkipped,
      fields,
      claims,
      recs: [],
      minConfidence,
    });
    for (const r of reviews) {
      log(
        "reviewer",
        r.verdict === "approve" ? "success" : "warn",
        `${r.targetAgent}: ${r.verdict}.`,
        { field: r.targetAgent, evidence: r.comment, confidence: 0.82 }
      );
    }
    setAgent({
      agent: "reviewer",
      status: "done",
      summary: reviews.map((r) => `${r.targetAgent}:${r.verdict}`).join(" · "),
      confidence: 0.82,
    });
  }

  let recs: Recommendation[] = [];
  const recOn =
    isAgentOn(enabled, "recommender") &&
    can(perms, "recommender", "write_recommendations");
  if (!recOn) {
    setAgent({
      agent: "recommender",
      status: "skipped",
      summary: "Agente deshabilitado",
      confidence: 0,
    });
    log("recommender", "warn", "Recomendaciones saltadas.", {
      field: "recs",
      confidence: 0,
    });
  } else {
    setAgent({
      agent: "recommender",
      status: "running",
      summary: "Priorizando acciones",
      confidence: 0,
    });
    await delay(140);
    recs = recommend(inputKind, fields, seoSummary, claims, minConfidence);
    recs.forEach((rec, i) => {
      log("recommender", "success", rec.title, {
        field: `rec_${i + 1}`,
        confidence: rec.confidence,
        evidence: rec.detail,
      });
    });
    const rc = recs.reduce((n, r) => n + r.confidence, 0) / Math.max(recs.length, 1);
    setAgent({
      agent: "recommender",
      status: "done",
      summary: `${recs.length} acciones`,
      confidence: clamp(rc),
    });
  }

  if (reviewerOn && recs.length) {
    const extra = reviewAgents({
      seoSkipped,
      factsSkipped,
      fields,
      claims,
      recs,
      minConfidence,
    }).find((r) => r.targetAgent === "recommender");
    if (extra) {
      reviews = [...reviews.filter((r) => r.targetAgent !== "recommender"), extra];
      log("reviewer", "decision", extra.comment, {
        field: "recommender",
        evidence: extra.verdict,
        confidence: 0.82,
      });
      setAgent({
        agent: "reviewer",
        status: "done",
        summary: reviews.map((r) => `${r.targetAgent}:${r.verdict}`).join(" · "),
        confidence: 0.82,
      });
    }
  }

  const doneAgents = agents.filter((a) => a.status === "done");
  const overall = clamp(
    doneAgents.reduce((a, b) => a + b.confidence, 0) /
      Math.max(doneAgents.length, 1)
  );
  const humanRequired =
    can(perms, "reviewer", "request_human") &&
    (fields.some((f) => f.needsHuman) || overall < hitlThreshold);

  const claudeNote = await narrateWithClaude(
    `En 2 frases, resume este paquete de orquestación para un operador: tipo=${inputKind}, confianza=${overall.toFixed(2)}, HITL=${humanRequired}, campos=${fields.length}, claims=${claims.length}. No inventes métricas.`
  );
  if (claudeNote) {
    log("orchestrator", "info", claudeNote, {
      field: "claude_narration",
      confidence: overall,
      evidence: "Narrativa Claude sobre números ya calculados.",
    });
  } else {
    log("orchestrator", "info", "Claude API no configurada: se omite narración.", {
      field: "claude_narration",
      confidence: overall,
      evidence: "Fallback local. El cómputo no depende del LLM.",
    });
  }

  log("orchestrator", "decision", `Consolidado en ${Date.now() - t0} ms.`, {
    field: "overall",
    confidence: overall,
    evidence: `HITL=${humanRequired} · agentes activos=${doneAgents.length}`,
  });
  setAgent({
    agent: "orchestrator",
    status: "done",
    summary: `Confianza ${overall.toFixed(2)}`,
    confidence: overall,
  });

  const finishedAt = now();
  const result: PipelineResult = {
    runId,
    startedAt,
    finishedAt,
    durationMs: Date.now() - t0,
    inputKind,
    sourceText: text,
    sourceUrl,
    fields,
    claims,
    recommendations: recs,
    reviews,
    agents,
    logs: collected,
    overallConfidence: overall,
    humanRequired,
    activeAgents: doneAgents.length,
    thresholds: { minConfidence, hitlThreshold },
    claudeEnabled: isClaudeConfigured(),
    supabaseEnabled: isSupabaseConfigured(),
  };
  emit({ type: "result", result });
  return result;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
