import { getBundle, markCleanedExport } from "@/lib/store";
import { cleanedFileName, exportCleanedXlsx } from "@/lib/export";
import { sha256 } from "@/lib/hash";
import { visitorFromRequest, withVisitorCookie } from "@/lib/visitor";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const visitor = visitorFromRequest(req);
  const bundle = await getBundle(id, visitor.id);
  if (!bundle) return withVisitorCookie(req, Response.json({ error: "Dataset not found." }, { status: 404 }));
  const bytes = exportCleanedXlsx(bundle, "Cleaned");
  await markCleanedExport(id, sha256(bytes), bundle.grid, visitor.id);
  const filename = cleanedFileName(bundle.dataset.originalFileName, "xlsx");
  return withVisitorCookie(
    req,
    new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Helix-Original-Hash": bundle.original.hash,
        "X-Helix-Never-Overwrite": "true",
      },
    })
  );
}
