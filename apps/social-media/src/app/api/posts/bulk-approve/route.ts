import { deskWriteDenied, humanActor } from "@/lib/ai-desk";
import { deskErrorResponse } from "@/lib/http-error";
import { approvePerfect, type BatchFilter } from "@/lib/store";
import type { Channel, Pillar } from "@/lib/types";

export const runtime = "nodejs";

const CHANNELS: Channel[] = ["instagram", "linkedin", "x", "tiktok", "facebook"];
const PILLARS: Pillar[] = ["product", "behind_the_scenes", "education", "community", "promo"];

/** Approves in-review posts whose readiness score is 100 and that match the optional filter. */
export async function POST(req: Request) {
  const denied = deskWriteDenied(req);
  if (denied) return denied;
  let body: { channel?: unknown; pillar?: unknown; from?: unknown; to?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const filter: BatchFilter = {
    channel: CHANNELS.includes(body.channel as Channel) ? (body.channel as Channel) : null,
    pillar: PILLARS.includes(body.pillar as Pillar) ? (body.pillar as Pillar) : null,
    from: typeof body.from === "string" ? body.from : null,
    to: typeof body.to === "string" ? body.to : null,
  };
  try {
    const result = await approvePerfect(humanActor(req), filter);
    return Response.json(result);
  } catch (err) {
    const mapped = deskErrorResponse(err);
    if (mapped) return mapped;
    throw err;
  }
}
