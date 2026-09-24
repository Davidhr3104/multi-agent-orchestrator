import { EngineShell } from "@/components/engine-shell";
import { JoinQueueDesk } from "@/components/join-queue-desk";

export default function UnmatchedPage() {
  return (
    <EngineShell active="unmatched">
      <JoinQueueDesk />
    </EngineShell>
  );
}
