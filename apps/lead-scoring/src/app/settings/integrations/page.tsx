import { HelixPage } from "@/components/helix-page";

export default function IntegrationsPage() {
  return (
    <HelixPage title="Integrations" hint="Connect CRM, Slack HITL, and calendar. Keys live in the server env.">
      <div className="card-bg space-y-3 rounded-xl p-5 text-sm text-slate-300">
        <p>GoHighLevel — GHL_API_KEY + GHL_LOCATION_ID (contact upsert).</p>
        <p>Slack HITL — SLACK_WEBHOOK_URL. Review buttons open /api/leads/:id/review and /archive.</p>
        <p>Calendly — CALENDLY_URL used for meeting slots on hot leads.</p>
        <p className="text-slate-400">HELIX_PUBLIC_URL should be your deployed origin so Slack links work.</p>
      </div>
    </HelixPage>
  );
}
