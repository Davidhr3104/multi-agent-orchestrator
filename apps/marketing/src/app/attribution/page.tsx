import { EngineShell } from "@/components/engine-shell";
import { AttributionDesk } from "@/components/attribution-desk";

export default function AttributionPage() {
  return (
    <EngineShell active="attribution">
      <AttributionDesk />
    </EngineShell>
  );
}
