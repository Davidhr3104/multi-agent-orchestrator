import { EngineShell } from "@/components/engine-shell";
import { OperatorUnlockPanel } from "@/components/operator-unlock-panel";
import { operatorSession } from "@/lib/operator-session";

export default async function OperatorPage() {
  const { operator, configured } = await operatorSession();
  return (
    <EngineShell active="operator">
      <OperatorUnlockPanel configured={configured} initialUnlocked={operator} />
    </EngineShell>
  );
}
