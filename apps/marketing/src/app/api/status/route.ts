export const runtime = "nodejs";

export async function GET() {
  return Response.json({
    meta: false,
    google: false,
    csv: true,
  });
}
