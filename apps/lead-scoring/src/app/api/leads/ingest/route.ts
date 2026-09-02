import { encodeSse, parseLeadIngest, runLeadPipeline, type LeadStreamEvent } from "@helix/core";
import { saveLead } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = parseLeadIngest(body);
  if (typeof parsed === "string") {
    return Response.json({ error: parsed }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: LeadStreamEvent) => {
        controller.enqueue(encodeSse(event));
      };
      try {
        const lead = await runLeadPipeline(parsed, send);
        await saveLead(lead);
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
