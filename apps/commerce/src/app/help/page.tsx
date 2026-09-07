import { HOW_TO_USE_COMMERCE } from "@helix/help";
import { HowToUsePanel } from "@/components/how-to-use-panel";

export default function HelpPage() {
  return (
    <div className="space-y-2">
      <HowToUsePanel guide={HOW_TO_USE_COMMERCE} />
    </div>
  );
}
