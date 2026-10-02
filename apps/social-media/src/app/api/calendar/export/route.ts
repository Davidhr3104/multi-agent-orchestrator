import { toCsv, toExportRows, toPdf } from "@/lib/export-doc";
import { matchesFilter, readCalendarFilter } from "@/lib/filters";
import { listPosts } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const filter = readCalendarFilter({
    channel: url.searchParams.get("channel") ?? undefined,
    pillar: url.searchParams.get("pillar") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  const rows = toExportRows((await listPosts()).filter((post) => matchesFilter(post, filter)));
  if (format === "csv") {
    return new Response(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": "attachment; filename=helix-social-calendar.csv",
      },
    });
  }
  if (format === "json") {
    return new Response(JSON.stringify(rows, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": "attachment; filename=helix-social-calendar.json",
      },
    });
  }
  if (format === "pdf") {
    return new Response(Buffer.from(toPdf("Helix for Social — calendar export", rows)), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": "attachment; filename=helix-social-calendar.pdf",
      },
    });
  }
  return Response.json({ error: "format must be csv, json or pdf" }, { status: 400 });
}
