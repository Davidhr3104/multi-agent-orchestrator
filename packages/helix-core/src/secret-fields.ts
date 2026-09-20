export type SecretField = {
  name: string;
  label: string;
  hint: string;
  stub?: boolean;
};

export const KEYS_SHARED: SecretField[] = [
  {
    name: "ANTHROPIC_API_KEY",
    label: "Anthropic (Claude)",
    hint: "Powers REC/EXT when set. Heuristic still runs without it.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_URL",
    label: "Supabase URL",
    hint: "Same project as the other Helix desks.",
  },
  {
    name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    label: "Supabase anon key",
    hint: "Public anon key. Prefer the service role on the server. Also enables real user sign-in (/login) and per-org data isolation once set alongside the Supabase URL.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    label: "Supabase service role",
    hint: "Persists desk data. Never expose this to the browser.",
  },
  {
    name: "HELIX_OPERATOR_KEY",
    label: "Operator key",
    hint: "Locks HITL and CRM writes. Leave empty for local-only. Unlock in Settings after saving.",
  },
];

export const KEYS_LEADS: SecretField[] = [
  ...KEYS_SHARED,
  { name: "GHL_API_KEY", label: "GoHighLevel API key", hint: "Contact upsert. Without both GHL fields, Send to CRM returns an error — it does not fake a send." },
  { name: "GHL_LOCATION_ID", label: "GoHighLevel location ID", hint: "Required with the GHL API key." },
  {
    name: "GHL_PIPELINE_ID",
    label: "GoHighLevel pipeline ID",
    hint: "Optional. When set, Send to CRM also creates/updates an opportunity in this pipeline — not just the contact.",
  },
  {
    name: "GHL_STAGE_HOT",
    label: "GHL stage — hot leads",
    hint: "Pipeline stage ID for hot-tier leads. Required if pipeline ID is set.",
  },
  {
    name: "GHL_STAGE_WARM",
    label: "GHL stage — warm leads",
    hint: "Pipeline stage ID for warm-tier leads. Required if pipeline ID is set.",
  },
  {
    name: "GHL_STAGE_COLD",
    label: "GHL stage — cold leads",
    hint: "Pipeline stage ID for cold-tier leads. Required if pipeline ID is set.",
  },
  { name: "SLACK_WEBHOOK_URL", label: "Slack webhook", hint: "Optional hot-lead ping." },
  { name: "CALENDLY_URL", label: "Calendly URL", hint: "Fallback link when Cal.com is not configured — not a real booking, just a suggested link." },
  {
    name: "CALCOM_API_KEY",
    label: "Cal.com API key",
    hint: "Real booking: reads live availability and confirms the meeting on the lead. Without it, meeting slots stay a heuristic suggestion.",
  },
  {
    name: "CALCOM_EVENT_TYPE_ID",
    label: "Cal.com event type ID",
    hint: "Required with the Cal.com API key — the event type slots are pulled from.",
  },
];

export const KEYS_LEGAL: SecretField[] = [...KEYS_SHARED];

export const KEYS_INBOX: SecretField[] = [
  ...KEYS_SHARED,
  { name: "RESEND_API_KEY", label: "Resend", hint: "Fallback send path when no Gmail account is connected. Approve fails loudly until either this or a connected Gmail account exists." },
  { name: "RESEND_FROM", label: "Resend from", hint: "From address, e.g. Helix <ops@yourdomain.com>. Required with the Resend API key." },
  {
    name: "GOOGLE_OAUTH_CLIENT_ID",
    label: "Google OAuth client ID",
    hint: "From Google Cloud Console (OAuth 2.0 Client, Gmail API enabled). Required for 1-click Gmail connect.",
  },
  {
    name: "GOOGLE_OAUTH_CLIENT_SECRET",
    label: "Google OAuth client secret",
    hint: "Paired with the client ID above. Required for 1-click Gmail connect.",
  },
  {
    name: "GMAIL_ACCESS_TOKEN",
    label: "Gmail access token (legacy)",
    hint: "Manual fallback: paste a short-lived OAuth access token. Prefer Connect Gmail in Settings, which stores a refreshable token per workspace instead.",
  },
  {
    name: "HELIX_LEADS_WEBHOOK_URL",
    label: "Helix for Leads webhook URL",
    hint: "Full URL from Helix for Leads → Settings → Workspace (the GHL webhook URL for that workspace). Enables 'Send to Leads' handoff on buyer-intent threads.",
  },
  { name: "SLACK_WEBHOOK_URL", label: "Slack webhook", hint: "Optional ping when a buyer-intent thread arrives, and for the weekly hours-saved report." },
  {
    name: "CRON_SECRET",
    label: "Cron secret",
    hint: "Optional. Set the same value as Vercel's CRON_SECRET env var to require it on the weekly report endpoint — otherwise that endpoint accepts any GET.",
  },
];

export const KEYS_COMMERCE: SecretField[] = [
  ...KEYS_SHARED,
  { name: "SHOPIFY_STORE_DOMAIN", label: "Shopify store domain", hint: "example.myshopify.com" },
  { name: "SHOPIFY_ACCESS_TOKEN", label: "Shopify Admin API token", hint: "Live Admin API when both Shopify fields are set. Load demo for the mock catalog." },
  {
    name: "SHOPIFY_WEBHOOK_SECRET",
    label: "Shopify webhook secret",
    hint: "From the webhook subscription in Shopify admin (or your app's API credentials). Required for live webhooks — without it, /api/webhooks/shopify rejects everything.",
  },
];

export const KEYS_MARKETING: SecretField[] = [
  ...KEYS_SHARED,
  {
    name: "META_ACCESS_TOKEN",
    label: "Meta Ads access token",
    hint: "Token with ads_read + ads_management. Enables Insights sync and HITL pause/scale write-back to Ads Manager.",
  },
  {
    name: "META_AD_ACCOUNT_ID",
    label: "Meta ad account id",
    hint: "act_123… or bare digits. Required for Insights sync and campaign writes.",
  },
  {
    name: "GOOGLE_ADS_DEVELOPER_TOKEN",
    label: "Google Ads developer token",
    hint: "Saved for later. Google Ads read/write is not live this sprint — use CSV ingest.",
    stub: true,
  },
];
