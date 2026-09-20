import { HelixPage } from "@/components/helix-page";
import { KEYS_LEADS } from "@helix/core/secret-fields";
import { ApiKeysForm } from "@helix/help/keys-form";

export default function IntegrationsPage() {
  return (
    <HelixPage title="Integrations" hint="Paste CRM, Slack, and calendar keys here. They stay on the server.">
      <div className="card-bg mb-4 space-y-3 rounded-xl p-5 text-sm text-slate-300">
        <p>GoHighLevel — contact upsert. Without both fields, Send to CRM returns an error.</p>
        <p>Slack HITL — review buttons open /api/leads/:id/review and /archive.</p>
        <p>Calendly — meeting slots on hot leads.</p>
        <p className="text-slate-400">HELIX_PUBLIC_URL should be your deployed origin so Slack links work.</p>
      </div>
      <div className="card-bg rounded-xl p-5">
        <ApiKeysForm initialFields={KEYS_LEADS} />
      </div>
    </HelixPage>
  );
}
