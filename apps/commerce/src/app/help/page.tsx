import Link from "next/link";
import { HOW_TO_USE_COMMERCE } from "@helix/help";
import { HowToUsePanel } from "@/components/how-to-use-panel";

export default function HelpPage() {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Link href="/?tour=1" className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110">
          Take the tour
        </Link>
      </div>
      <HowToUsePanel guide={HOW_TO_USE_COMMERCE} />
    </div>
  );
}
