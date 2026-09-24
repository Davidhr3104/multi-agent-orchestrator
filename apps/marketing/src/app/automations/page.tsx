import { EngineShell } from "@/components/engine-shell";
import { AutomationsDesk } from "@/components/automations-desk";

export default function AutomationsPage() {
  return (
    <EngineShell active="automations">
      <AutomationsDesk />
    </EngineShell>
  );
}
