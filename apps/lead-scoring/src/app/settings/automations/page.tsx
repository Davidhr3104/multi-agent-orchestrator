import { HelixPage } from "@/components/helix-page";

export default function AutomationsPage() {
  return (
    <HelixPage title="Automations" hint="Follow-up sequences are queued by score, not sent until SMTP is connected.">
      <div className="card-bg space-y-2 rounded-xl p-5 text-sm text-slate-300">
        <p>Hot (&gt;80) → immediate email.</p>
        <p>Warm (60–80) → case study in 2 hours.</p>
        <p>Cold (&lt;60) → educational email in 24 hours.</p>
      </div>
    </HelixPage>
  );
}
