"use client";

import { HOW_TO_USE_INBOX, TOUR_INBOX } from "@helix/help";
import { HowToUsePanel } from "@/components/how-to-use-panel";
import { startHelixTour } from "@/lib/product-tour";

export default function HelpPage() {
  return (
    <div className="space-y-4 p-8">
      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
          onClick={() => startHelixTour("inbox", TOUR_INBOX, { force: true })}
        >
          Restart product tour
        </button>
      </div>
      <HowToUsePanel guide={HOW_TO_USE_INBOX} />
    </div>
  );
}
