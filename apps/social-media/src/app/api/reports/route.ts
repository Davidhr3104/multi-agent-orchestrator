import { deskWriteDenied } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { createReport } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  try {
    const report = await createReport();
    return Response.json({ report });
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
