import { parseEml } from "@helix/core/inbox/eml";
import { appendEmlToThread, findThreadForEml, ingestMessage } from "@/lib/store";
import { requireOperator } from "@helix/core/operator";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing .eml file" }, { status: 400 });
  }
  const raw = Buffer.from(await file.arrayBuffer());
  const parsed = await parseEml(raw);

  const matched = await findThreadForEml(parsed);
  if (matched) {
    const message = await appendEmlToThread(matched, parsed);
    return Response.json({ threadId: matched.id, created: false, message });
  }

  const created = await ingestMessage({
    fromName: parsed.fromEmail,
    fromEmail: parsed.fromEmail,
    subject: parsed.subject,
    body: parsed.textBody,
    rfcMessageId: parsed.rfcMessageId,
  });
  return Response.json({ threadId: created.id, created: true, message: created });
}
