import { parseEml } from "@helix/core/inbox/eml";
import { appendEmlToThread, findThreadForEml, ingestMessage } from "@/lib/store";
import { deskWriteDenied, mayUseClaude } from "@/lib/ai-desk";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;

  // M6: a malformed multipart body or an unparseable .eml must return a
  // clean 400, never an unhandled 500 — this is user-uploaded input.
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Missing .eml file" }, { status: 400 });
    }
    const raw = Buffer.from(await file.arrayBuffer());
    const parsed = await parseEml(raw);

    const matched = await findThreadForEml(parsed);
    if (matched) {
      const { message, duplicate } = await appendEmlToThread(matched, parsed);
      return Response.json({ threadId: matched.id, created: false, duplicate, message });
    }

    const created = await ingestMessage({
      fromName: parsed.fromName || parsed.fromEmail,
      fromEmail: parsed.fromEmail,
      subject: parsed.subject,
      body: parsed.textBody,
      rfcMessageId: parsed.rfcMessageId,
      sentAt: parsed.date,
      heuristicOnly: !mayUseClaude(req),
    });
    return Response.json({ threadId: created.id, created: true, message: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Invalid .eml upload: ${msg}` }, { status: 400 });
  }
}
