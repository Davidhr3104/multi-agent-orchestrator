import { cookies } from "next/headers";
import { DeskHome } from "@/components/desk-home";
import { deskStatus, kpis, listBundles } from "@/lib/store";
import { VISITOR_COOKIE } from "@/lib/visitor";

export const dynamic = "force-dynamic";

export default async function DeskPage() {
  const jar = await cookies();
  const visitorId = jar.get(VISITOR_COOKIE)?.value ?? "anon";
  const [metrics, rows, status] = await Promise.all([kpis(visitorId), listBundles(visitorId), deskStatus()]);
  return <DeskHome kpis={metrics} rows={rows} mode={status.mode} />;
}
