import { ingestMessage, listMessages, wakeSnoozed, applyDeskPatches } from "@/lib/store";
import {
  applyThreadPatches,
  jsonWithDeskCookie,
  patchFromThread,
  readDeskCookie,
  upsertDeskPatch,
} from "@/lib/desk-state-cookie";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const state = readDeskCookie(req);
  applyDeskPatches(state.patches);
  await wakeSnoozed();
  const messages = applyThreadPatches(await listMessages(), state.patches);
  return Response.json({ messages });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const row = body as {
    fromName?: string;
    fromEmail?: string;
    subject?: string;
    body?: string;
  };
  const fromName = row.fromName?.trim() ?? "";
  const fromEmail = row.fromEmail?.trim() ?? "";
  const subject = row.subject?.trim() ?? "";
  const text = row.body?.trim() ?? "";
  if (!fromName || !fromEmail || !subject || !text) {
    return Response.json({ error: "fromName, fromEmail, subject, body required" }, { status: 400 });
  }
  try {
    let state = readDeskCookie(req);
    applyDeskPatches(state.patches);
    const message = await ingestMessage({ fromName, fromEmail, subject, body: text });
    state = upsertDeskPatch(state, message.id, patchFromThread(message));
    return jsonWithDeskCookie({ message }, state);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
