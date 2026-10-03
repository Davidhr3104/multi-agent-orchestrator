import { requireOperator } from "@helix/core/operator";
import { syncMailboxes } from "@/lib/mail-sync";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  const r = await syncMailboxes();
  if (!r.ok) return Response.json({ error: r.error }, { status: 502 });
  return Response.json({
    imported: r.imported,
    scanned: r.scanned,
    accountsSynced: r.accountsSynced,
    errors: r.errors,
  });
}
