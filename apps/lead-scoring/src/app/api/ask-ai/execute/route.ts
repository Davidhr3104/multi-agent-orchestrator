import { archive } from "@/app/api/leads/[id]/archive/route";
import { operatorActor, requireOperator } from "@helix/core/operator";
import { withOrgScope } from "@/lib/org-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = requireOperator(req);
  if (denied) return denied;

  const body = (await req.json()) as { action?: string; targetIds?: string[] };

  if (body.action !== "archive_leads") {
    return Response.json({ error: "Unsupported action" }, { status: 400 });
  }
  if (!Array.isArray(body.targetIds) || body.targetIds.length === 0) {
    return Response.json({ error: "targetIds must be a non-empty array" }, { status: 400 });
  }

  return withOrgScope(async (orgId): Promise<Response> => {
    const actor = operatorActor(req);
    const archived: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const id of body.targetIds!) {
      try {
        const res = await archive(id, actor, orgId);
        if (res.ok) {
          archived.push(id);
        } else {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          failed.push({ id, error: data?.error ?? `HTTP ${res.status}` });
        }
      } catch (err) {
        failed.push({ id, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return Response.json({ archived, failed });
  });
}
