import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { AGENT_CATALOG } from "@/lib/permissions";
import type { PipelineResult } from "@/lib/types";

function pdfSafe(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "?");
}

export const runtime = "nodejs";

export async function POST(req: Request) {
  let result: PipelineResult;
  try {
    result = (await req.json()) as PipelineResult;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!result?.runId) {
    return Response.json({ error: "Falta el resultado del pipeline." }, { status: 400 });
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const ink = rgb(0.08, 0.12, 0.2);
  const muted = rgb(0.35, 0.4, 0.48);

  const line = (text: string, size = 10, useBold = false) => {
    if (y < 48) {
      page = pdf.addPage([595, 842]);
      y = 800;
    }
    page.drawText(pdfSafe(text).slice(0, 110), {
      x: 48,
      y,
      size,
      font: useBold ? bold : font,
      color: useBold ? ink : muted,
    });
    y -= size + 8;
  };

  line("Helix Orchestrator — reporte de corrida", 16, true);
  line(`Run ${result.runId}`);
  line(
    `Duración ${(result.durationMs / 1000).toFixed(2)}s · Agentes activos ${result.activeAgents} · Confianza media ${result.overallConfidence.toFixed(2)}`
  );
  line(
    `Tipo ${result.inputKind} · HITL ${result.humanRequired ? "sí" : "no"} · min ${result.thresholds.minConfidence} · HITL ${result.thresholds.hitlThreshold}`
  );
  y -= 6;
  line("Decisiones por agente", 12, true);
  for (const run of result.agents) {
    const name = AGENT_CATALOG.find((a) => a.id === run.agent)?.name ?? run.agent;
    line(`${name}: ${run.decision ?? run.status} · conf ${run.confidence.toFixed(2)} · ${run.summary}`);
  }
  y -= 6;
  line("Campos", 12, true);
  for (const field of result.fields) {
    line(`${field.label}: ${field.value} (${field.confidence.toFixed(2)})`);
    line(`  evidencia: ${field.evidence}`);
  }
  y -= 6;
  line("Logs (extracto)", 12, true);
  for (const log of result.logs.slice(0, 40)) {
    line(
      `${log.ts.slice(11, 19)} ${log.agent} ${log.field ?? "-"} ${log.confidence?.toFixed(2) ?? "-"} ${log.message}`
    );
  }

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="helix-${result.runId}.pdf"`,
    },
  });
}
