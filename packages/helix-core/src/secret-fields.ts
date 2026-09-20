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
    hint: "Public anon key. Prefer the service role on the server.",
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
  { name: "SLACK_WEBHOOK_URL", label: "Slack webhook", hint: "Optional hot-lead ping." },
  { name: "CALENDLY_URL", label: "Calendly URL", hint: "Optional meeting slots on a lead." },
];

export const KEYS_LEGAL: SecretField[] = [...KEYS_SHARED];

export const KEYS_INBOX: SecretField[] = [
  ...KEYS_SHARED,
  { name: "RESEND_API_KEY", label: "Resend", hint: "Send reply uses Resend. Approve fails loudly until this is set." },
  { name: "RESEND_FROM", label: "Resend from", hint: "From address, e.g. Helix <ops@yourdomain.com>. Required with the API key." },
  { name: "GMAIL_ACCESS_TOKEN", label: "Gmail access token", hint: "Paste an OAuth access token. Sync pulls inbox mail. IMAP is not used this sprint." },
];

export const KEYS_COMMERCE: SecretField[] = [
  ...KEYS_SHARED,
  { name: "SHOPIFY_STORE_DOMAIN", label: "Shopify store domain", hint: "example.myshopify.com" },
  { name: "SHOPIFY_ACCESS_TOKEN", label: "Shopify Admin API token", hint: "Live Admin API when both Shopify fields are set. Load demo for the mock catalog." },
];

export const KEYS_MARKETING: SecretField[] = [
  ...KEYS_SHARED,
  {
    name: "META_ACCESS_TOKEN",
    label: "Meta Ads token",
    hint: "Saved for later. Confirm pause/scale does not write to Ads Manager this sprint.",
    stub: true,
  },
  {
    name: "GOOGLE_ADS_DEVELOPER_TOKEN",
    label: "Google Ads developer token",
    hint: "Saved for later. Same as Meta — no Ads Manager writes this sprint.",
    stub: true,
  },
];
