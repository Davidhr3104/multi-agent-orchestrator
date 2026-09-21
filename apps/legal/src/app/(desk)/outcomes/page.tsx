import { listRfps } from "@/lib/store";
import { summarizeLegalOutcomes } from "@helix/core";
import { OutcomesDesk } from "@/components/outcomes-desk";

export const dynamic = "force-dynamic";

export default async function OutcomesPage() {
  const rfps = await listRfps();
  const outcomes = summarizeLegalOutcomes(rfps);
  return <OutcomesDesk initialRfps={rfps} initialOutcomes={outcomes} />;
}
