import { EngineShell } from "@/components/engine-shell";
import { WasteDefenseDesk } from "@/components/waste-defense";

export default function WastePage() {
  return (
    <EngineShell active="waste">
      <WasteDefenseDesk />
    </EngineShell>
  );
}
