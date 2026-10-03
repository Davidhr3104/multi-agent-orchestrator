import { ClaudeUnavailableError } from "@/lib/social/claude";
import { InspirationError } from "@/lib/social/ai-drafts";
import { NetworkError } from "@/lib/social/config";
import { AccessError, DraftError, PublishError, ReviewError } from "@/lib/store";

export function deskErrorResponse(err: unknown): Response | null {
  if (err instanceof AccessError) return Response.json({ error: err.message }, { status: 403 });
  if (err instanceof DraftError || err instanceof ReviewError || err instanceof PublishError || err instanceof InspirationError) return Response.json({ error: err.message }, { status: 409 });
  if (err instanceof ClaudeUnavailableError) return Response.json({ error: err.message }, { status: 503 });
  if (err instanceof NetworkError) return Response.json({ error: `The network refused it: ${err.message} Nothing was published.` }, { status: 502 });
  if (err instanceof Error && err.message.startsWith("Auto-fix")) return Response.json({ error: err.message }, { status: 409 });
  return null;
}
