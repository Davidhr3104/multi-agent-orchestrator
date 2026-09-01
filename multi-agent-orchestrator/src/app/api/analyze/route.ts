import { runPipeline } from "@/lib/agents";
import { withDefaultRequest } from "@/lib/config";
import { persistPipelineLog } from "@/lib/supabase-logs";
import type { AnalyzeRequest, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: Partial<AnalyzeRequest>;
  try {
    body = (await req.json()) as Partial<AnalyzeRequest>;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const payload = withDefaultRequest(body);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let runId = "";
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        if (event.type === "log") {
          if (!runId && event.log.field === "run_id" && event.log.evidence) {
            runId = event.log.evidence;
          }
          void persistPipelineLog(runId || "pending", event.log);
        }
        if (event.type === "result") runId = event.result.runId;
      };
      try {
        await runPipeline(payload, send);
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
