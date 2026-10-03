export type SecretField = {
  name: string;
  label: string;
  hint: string;
  stub?: boolean;
};

function cronSecretField(legacyEndpoint?: string): SecretField {
  return {
    name: "CRON_SECRET",
    label: "Cron secret",
    hint: `Same value as Vercel's CRON_SECRET env var. Required for the scheduled jobs under /api/cron/*: they refuse to run without it.${
      legacyEndpoint ? ` It also locks the ${legacyEndpoint} endpoint, which otherwise accepts any GET.` : ""
    }`,
  };
}

const HUBSPOT_FIELD: SecretField = {
  name: "HUBSPOT_TOKEN",
  label: "HubSpot private app token",
  hint: "HubSpot → Settings → Integrations → Private Apps, with contact write scope. Pushes only after you confirm.",
};

const TWILIO_FIELDS: SecretField[] = [
  { name: "TWILIO_ACCOUNT_SID", label: "Twilio account SID", hint: "From the Twilio console. SMS/WhatsApp sends only after you confirm each message." },
  { name: "TWILIO_AUTH_TOKEN", label: "Twilio auth token", hint: "Paired with the account SID." },
  { name: "TWILIO_FROM", label: "Twilio sender", hint: "A Twilio number in E.164 format, e.g. +15550001111." },
];

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
  HUBSPOT_FIELD,
  {
    name: "HELIX_INTAKE_TOKEN",
    label: "Lead intake token",
    hint: "Secret path segment for the public intake URL /api/leads/intake/<token>, used when Supabase is not configured.",
  },
  cronSecretField(),
];

export const KEYS_LEGAL: SecretField[] = [
  ...KEYS_SHARED,
  {
    name: "SAM_GOV_API_KEY",
    label: "SAM.gov public API key",
    hint: "sam.gov → your profile → Account Details → Public API Key. Imports real federal RFPs; the daily quota is small.",
  },
  cronSecretField(),
];

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
  { name: "CALENDLY_TOKEN", label: "Calendly personal access token", hint: "Reads your scheduled Calendly events for the Calendar page." },
  HUBSPOT_FIELD,
  ...TWILIO_FIELDS,
  cronSecretField("weekly report"),
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
  { name: "SLACK_WEBHOOK_URL", label: "Slack webhook", hint: "Optional daily ops brief: high-risk orders + $ on hold." },
  cronSecretField("daily brief"),
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
    hint: "Google Ads MCC → Tools → API Center. Test access only reads test accounts; real accounts need Basic access. Read-only: Helix never writes to Google Ads.",
  },
  { name: "GOOGLE_ADS_CLIENT_ID", label: "Google Ads OAuth client ID", hint: "Google Cloud OAuth client with the Google Ads API enabled." },
  { name: "GOOGLE_ADS_CLIENT_SECRET", label: "Google Ads OAuth client secret", hint: "Paired with the client ID." },
  { name: "GOOGLE_ADS_REFRESH_TOKEN", label: "Google Ads refresh token", hint: "OAuth refresh token with the adwords scope." },
  { name: "GOOGLE_ADS_CUSTOMER_ID", label: "Google Ads customer ID", hint: "The account to read, digits only." },
  { name: "GOOGLE_ADS_LOGIN_CUSTOMER_ID", label: "Google Ads login customer ID", hint: "Only when access goes through a manager (MCC) account." },
  { name: "TIKTOK_ADS_ACCESS_TOKEN", label: "TikTok Ads access token", hint: "From your approved TikTok for Business app. Read-only reporting." },
  { name: "TIKTOK_ADS_ADVERTISER_ID", label: "TikTok advertiser ID", hint: "From TikTok Ads Manager." },
  { name: "SLACK_WEBHOOK_URL", label: "Slack webhook", hint: "Optional daily brief: $ spent, spend on spam, top waste campaign." },
  cronSecretField("daily brief"),
];

export const KEYS_SOCIAL: SecretField[] = [
  ...KEYS_SHARED,
  { name: "HELIX_META_ACCESS_TOKEN", label: "Meta access token", hint: "Long-lived user token for Instagram Business and the Facebook Page. Reads insights; publishing needs approval per post and the live switch." },
  { name: "HELIX_META_IG_USER_ID", label: "Instagram business account ID", hint: "From /{page-id}?fields=instagram_business_account." },
  { name: "HELIX_META_PAGE_ID", label: "Facebook Page ID", hint: "The Page linked to the Instagram account." },
  { name: "HELIX_META_PAGE_ACCESS_TOKEN", label: "Facebook Page access token", hint: "From /me/accounts. Needed to publish to the Page." },
  { name: "HELIX_LINKEDIN_ACCESS_TOKEN", label: "LinkedIn access token", hint: "3-legged OAuth token with w_organization_social. Lasts about 60 days." },
  { name: "HELIX_LINKEDIN_ORGANIZATION_URN", label: "LinkedIn organization", hint: "Organization number or urn:li:organization:N." },
  cronSecretField(),
];

export const KEYS_REAL_ESTATE: SecretField[] = [
  ...KEYS_SHARED,
  { name: "RESEND_API_KEY", label: "Resend", hint: "Sends approved buyer alerts by email, one confirmation per message." },
  { name: "RESEND_FROM", label: "Resend from", hint: "An address on a domain verified in Resend." },
  ...TWILIO_FIELDS,
  { name: "TWILIO_WHATSAPP_FROM", label: "Twilio WhatsApp sender", hint: "Optional, e.g. whatsapp:+14155238886 (sandbox) or an approved sender." },
  HUBSPOT_FIELD,
  { name: "HELIX_NIGHTLY_AI", label: "Nightly AI drafts", hint: "Set to off to make the nightly matching cron use templates only, with no Claude spend." },
  cronSecretField(),
];
