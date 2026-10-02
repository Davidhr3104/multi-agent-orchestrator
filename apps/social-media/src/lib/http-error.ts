import { AccessError, DraftError, ReviewError } from "@/lib/store";

export function deskErrorResponse(err: unknown): Response | null {
  if (err instanceof AccessError) return Response.json({ error: err.message }, { status: 403 });
  if (err instanceof DraftError || err instanceof ReviewError) return Response.json({ error: err.message }, { status: 409 });
  if (err instanceof Error && err.message.startsWith("Auto-fix")) return Response.json({ error: err.message }, { status: 409 });
  return null;
}
