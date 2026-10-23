import { operatorActor } from "@helix/core/operator";
import { decide } from "@/lib/store";
import type { DateReading } from "@/lib/rules";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const visitor = visitorFromRequest(req);
  let body: { changeIds?: string[]; status?: "approved" | "rejected"; readings?: Record<string, string> } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return withVisitorCookie(req, Response.json({ error: "JSON required." }, { status: 400 }));
  }
  if (!Array.isArray(body.changeIds) || (body.status !== "approved" && body.status !== "rejected")) {
    return withVisitorCookie(req, Response.json({ error: "changeIds and status required." }, { status: 400 }));
  }
  const readings: Record<string, DateReading> = {};
  for (const [changeId, reading] of Object.entries(body.readings ?? {})) {
    if (reading !== "mdy" && reading !== "dmy") {
      return withVisitorCookie(req, Response.json({ error: "readings must be \"mdy\" or \"dmy\"." }, { status: 400 }));
    }
    readings[changeId] = reading;
  }
  const actor = operatorActor(req);
  const dataset = await decide(id, body.changeIds, body.status, actor, visitor.id, readings);
  if (dataset === "Dataset not found.") return withVisitorCookie(req, Response.json({ error: dataset }, { status: 404 }));
  if (typeof dataset === "string") return withVisitorCookie(req, Response.json({ error: dataset }, { status: 400 }));
  return withVisitorCookie(req, Response.json({ dataset }));
}
