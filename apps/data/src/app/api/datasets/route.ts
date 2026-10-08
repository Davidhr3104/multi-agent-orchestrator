import { deskStatus, kpis, listBundles } from "@/lib/store";
import type { DatasetBundle } from "@/lib/types";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

function card(b: DatasetBundle) {
  return {
    ...b,
    grid: { headers: b.grid.headers, rows: [] as string[][] },
    originalGrid: { headers: b.originalGrid.headers, rows: [] as string[][] },
  };
}

export async function GET(req: Request) {
  const { id } = visitorFromRequest(req);
  const [status, metrics, datasets] = await Promise.all([deskStatus(), kpis(id), listBundles(id)]);
  return withVisitorCookie(
    req,
    Response.json({
      ...status,
      kpis: metrics,
      datasets: datasets.map(card),
    })
  );
}
