import { runPipeline } from "@/lib/agents";
import { DEFAULT_PERMISSIONS } from "@/lib/permissions";
import type { AnalyzeRequest, StreamEvent } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: AnalyzeRequest;
  try {
    body = (await req.json()) as AnalyzeRequest;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const payload: AnalyzeRequest = {
    text: body.text,
    url: body.url,
    permissions: body.permissions ?? DEFAULT_PERMISSIONS,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
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
