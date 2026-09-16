import { leadTierBandCopy } from "@helix/core";
import { HelixPage } from "@/components/helix-page";

const TIER_COPY = leadTierBandCopy();

export default function AutomationsPage() {
  return (
    <HelixPage title="Automations" hint="Follow-up sequences are queued by score, not sent until SMTP is connected.">
      <div className="card-bg space-y-2 rounded-xl p-5 text-sm text-slate-300">
        <p>{TIER_COPY.hotRule} → immediate email.</p>
        <p>{TIER_COPY.warmRule} → case study in 2 hours.</p>
        <p>{TIER_COPY.coldRule} → educational email in 24 hours.</p>
      </div>
    </HelixPage>
  );
}
