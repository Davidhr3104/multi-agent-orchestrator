import { EngineShell } from "@/components/engine-shell";
import { HitlReviewDesk } from "@/components/hitl-review-desk";

export default function ReviewPage() {
  return (
    <EngineShell active="review">
      <HitlReviewDesk />
    </EngineShell>
  );
}
