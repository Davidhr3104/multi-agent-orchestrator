import { pdfFromLines } from "@/lib/export-doc";
import { PILLAR_LABEL } from "@/lib/format";
import { getReport } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const report = await getReport(id);
  if (!report) return Response.json({ error: "Report not found" }, { status: 404 });
  const lines = [
    `${report.workspaceName} — executive read`,
    report.note,
    `${report.total} planned, ${report.approved} approved, ${report.perfect} at 100, average ${report.avgScore}.`,
    "",
    ...report.pillars.map((pillar) => `${PILLAR_LABEL[pillar.pillar]}: ${pillar.count} posts, average score ${pillar.avgScore}.`),
  ];
  return new Response(Buffer.from(pdfFromLines(lines)), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename=helix-social-${report.workspaceName.replace(/\s+/g, "-").toLowerCase()}.pdf`,
    },
  });
}
