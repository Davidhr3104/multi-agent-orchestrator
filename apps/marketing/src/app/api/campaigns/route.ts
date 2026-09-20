import { getSnapshot, parseMarketingWindow } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const snap = await getSnapshot(parseMarketingWindow(url.searchParams.get("window")));
  return Response.json(snap);
}
