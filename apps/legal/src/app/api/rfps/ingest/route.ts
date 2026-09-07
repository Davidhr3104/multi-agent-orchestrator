import { encodeSse, parseRfpIngest, runRfpPipeline, type RfpStreamEvent } from "@helix/core";
import { getClientProfile, recordAudit, saveRfp, checkAndStoreConflict, checkAndStorePricing } from "@/lib/store";
import { formatUsdNumber } from "@/lib/money";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseRfpIngest(body);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }
  if (!parsed.clientProfile) parsed.clientProfile = getClientProfile();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: RfpStreamEvent) => {
        controller.enqueue(encodeSse(event));
      };
      try {
        const rfp = await runRfpPipeline(parsed, send);
        await saveRfp(rfp);
        const coi = await checkAndStoreConflict(rfp);
        send({
          type: "log",
          log: {
            id: `coi-${rfp.id}`,
            ts: new Date().toISOString(),
            agent: "reviewer",
            level: coi.verdict === "GO" ? "success" : "warn",
            message: `Conflict check ${coi.verdict} (${coi.score}) · ${coi.why}`,
          },
        });
        const quote = await checkAndStorePricing(rfp);
        send({
          type: "log",
          log: {
            id: `price-${rfp.id}`,
            ts: new Date().toISOString(),
            agent: "reviewer",
            level: "success",
            message: `Smart price ${quote.practiceArea} target ${formatUsdNumber(quote.target)} (${quote.estimatedHours}h)`,
          },
        });
        await recordAudit(
          "ops",
          "ingest",
          `${rfp.title} · ${rfp.method} · ${rfp.tier} · COI ${coi.verdict} · bid ${quote.target}`
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
