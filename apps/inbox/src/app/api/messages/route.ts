import { ingestMessage, listMessages, wakeSnoozed } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  await wakeSnoozed();
  const messages = await listMessages();
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
    const message = await ingestMessage({ fromName, fromEmail, subject, body: text });
    return Response.json({ message });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ error: msg }, { status: 500 });
  }
}
