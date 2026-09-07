import { HOW_TO_USE_LEGAL } from "@helix/help";
import { HowToUsePanel } from "@/components/how-to-use-panel";

export default function HelpPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-7 lg:px-8">
      <HowToUsePanel guide={HOW_TO_USE_LEGAL} />
    </main>
  );
}
