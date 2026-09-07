/**
 * Shared Helix Help & Onboarding copy.
 * Keep strings concise, professional, and product-agnostic where possible.
 */

export type HelpSide = "top" | "right" | "bottom" | "left";

export type HowToUseStep = {
  title: string;
  body: string;
};

export type HowToUseShortcut = {
  keys: string;
  action: string;
};

export type HowToUseGuide = {
  product: string;
  title: string;
  overview: string;
  steps: HowToUseStep[];
  hitlTip: string;
  shortcuts: HowToUseShortcut[];
  /** Optional product walkthrough video (served from the app public/ folder). */
  videoSrc?: string;
  videoTitle?: string;
};

/** Family-wide concepts shared by every Helix desk */
export const HELIX_HELP = {
  hitl: "Human-in-the-Loop: low-confidence AI decisions wait here for your approve, revise, or block action.",
  confidence:
    "AI confidence for this recommendation. Lower scores are more likely to need human review before acting.",
  audit: "Immutable log of AI decisions and human overrides for compliance and debugging.",
  theme: "Switch between light and dark desk themes. Preference is saved for this workspace.",
} as const;

export const INBOX_HELP = {
  openThreads: "Total threads currently in the triage workspace, including open and review items.",
  needReview: "Threads where AI confidence is low or policy requires an EA to approve before routing.",
  urgent: "High-urgency or SLA-sensitive threads that should be handled within the hour.",
  blocked: "Spam and filtered mail. Unblock to return a thread to the active triage queue.",
  queue: "Live triage list. Select a thread to inspect the draft, route target, and reasoning.",
  ingest: "Paste an inbound email to score category, urgency, and draft a reply automatically.",
  inspector: "Review the AI recommendation, edit if needed, then approve, route, snooze, or block.",
  autoTriage: "When enabled, new inbound mail is classified and drafted without a manual ingest step.",
  vipSenders: "Senders on this list are always prioritized in the queue, regardless of content signals.",
  hitlQueue: "Dedicated review lane for decisions that need a human before anything is sent or routed.",
  routed: "Threads that have already been processed and handed off or sent.",
} as const;

export const LEGAL_HELP = {
  goNoGo: "Recommended pursuit decision based on RFP fit, capacity, conflicts, and commercial terms.",
  factCites: "Extracted fields are tied to source spans. Prefer cited values over unverified guesses.",
  coi: "Conflict-of-interest signals that may block or delay a bid until cleared by counsel.",
  pricing: "Suggested fee posture derived from scope, deadlines, and comparable firm engagements.",
} as const;

export const LEADS_HELP = {
  score: "Lead quality score from 0–100 based on intent, fit, and enrichment signals.",
  classification: "Whether this inbound looks like a real lead, spam, or informational inquiry.",
  hitl: "Leads below the confidence threshold wait for human approve or revise before CRM sync.",
  enrich: "Company and contact enrichment used to improve scoring and outreach personalization.",
} as const;

export const COMMERCE_HELP = {
  catalog: "Product and inventory intelligence for merchandising and ops decisions.",
  ops: "Operational signals that may need review before publishing or fulfilling changes.",
  fraud: "AI fraud score 0–100. High-risk orders wait in HITL before fulfill or cancel.",
  restock: "Inventory signals that recommend reorder before stockouts hit the storefront.",
} as const;

export const HOW_TO_USE_COMMERCE: HowToUseGuide = {
  product: "Helix for Commerce",
  title: "How to use",
  overview:
    "Score orders for fraud, flag restock risks, and keep high-risk fulfillment decisions in human review before Shopify sync.",
  videoSrc: "/help/helix-commerce-howto.mp4",
  videoTitle: "Product walkthrough (~1m 45s)",
  steps: [
    {
      title: "1. Open the Dashboard",
      body: "Scan revenue, fulfillment, and restock alerts. Live orders show which tickets need HITL review first.",
    },
    {
      title: "2. Work Orders with the inspector",
      body: "Select an order to see fraud score, reasoning, and customer context. Approve, flag, or cancel from HITL Review.",
    },
    {
      title: "3. Products and Inventory",
      body: "Browse catalog health, then use Inventory for reorder recommendations before stockouts hit the storefront.",
    },
    {
      title: "4. Customers and Analytics",
      body: "Review customer signals and Analytics charts for revenue and risk trends across the desk.",
    },
    {
      title: "5. Settings and Sync",
      body: "Confirm Shopify, Claude, and Supabase status. Use Sync Shopify when credentials are configured; otherwise the desk runs on mock + heuristics.",
    },
  ],
  hitlTip:
    "Orders marked HITL Review stay out of fulfill until you approve or cancel. Prefer review when fraud confidence is low rather than auto-shipping risk.",
  shortcuts: [
    { keys: "Ctrl+K", action: "Focus search for orders and SKUs" },
    { keys: "Orders", action: "HITL queue for fraud review" },
    { keys: "Theme toggle", action: "Switch light / dark from the header" },
  ],
};

export const HOW_TO_USE_INBOX: HowToUseGuide = {
  product: "Helix for Inbox",
  title: "How to use",
  overview:
    "Triage inbound email with multi-agent scoring, draft replies, and human review before anything is sent or routed.",
  videoSrc: "/help/helix-inbox-howto.mp4",
  videoTitle: "60-second product walkthrough",
  steps: [
    {
      title: "1. Open the Dashboard",
      body: "Scan metrics for open threads, need-review, urgent, and blocked. Use filters or ⌘K to find a thread fast.",
    },
    {
      title: "2. Ingest or wait for triage",
      body: "Paste an email into Ingest thread, or enable auto-triage in Settings so new mail is classified automatically.",
    },
    {
      title: "3. Work the HITL queue",
      body: "Open HITL queue for low-confidence decisions. Select a thread to see category, route target, reasoning, and draft.",
    },
    {
      title: "4. Act in the inspector",
      body: "Approve the draft, route to the owner, regenerate the reply, snooze, or block spam. Every action is audited.",
    },
    {
      title: "5. Tune preferences",
      body: "In Settings, set reply tone, VIP senders, and theme. Routed and Blocked views keep a clean history.",
    },
  ],
  hitlTip:
    "Anything marked Need review stays in HITL until you approve or block. Prefer review when confidence is low rather than auto-sending.",
  shortcuts: [
    { keys: "⌘K / Ctrl+K", action: "Focus the queue filter" },
    { keys: "Filters", action: "All · Urgent · Needs Review on the Dashboard" },
    { keys: "Theme toggle", action: "Switch light / dark from the header" },
  ],
};

export const HOW_TO_USE_LEGAL: HowToUseGuide = {
  product: "Helix for Legal",
  title: "How to use",
  overview:
    "Turn messy RFPs into cited extracted fields, Go/No-Go, COI checks, pricing posture, and proposal packs with human oversight.",
  steps: [
    {
      title: "1. Start on the Dashboard",
      body: "Drop or paste an RFP. Helix extracts fields with FACT cites, then scores fit against your firm profile.",
    },
    {
      title: "2. Review Opportunities",
      body: "Open each opportunity to inspect evidence spans, deadlines, compliance gaps, and competitive notes.",
    },
    {
      title: "3. Resolve Go/No-Go and COI",
      body: "Confirm or override the pursuit verdict. Clear conflict signals before committing partner time.",
    },
    {
      title: "4. Pricing and documents",
      body: "Use Pricing for fee posture, Documents for packs, and Deadlines so nothing slips past ISO dates.",
    },
    {
      title: "5. Settings and Audit",
      body: "Keep the client profile accurate in Settings. Audit Log records AI decisions and human overrides.",
    },
  ],
  hitlTip:
    "Treat unverified fields as incomplete. Prefer cited spans over invented values when preparing partner review.",
  shortcuts: [
    { keys: "Search", action: "Find RFPs from the desk header" },
    { keys: "Documents", action: "Proposal and exhibit packs" },
    { keys: "Audit Log", action: "Full decision trail for compliance" },
  ],
};

export const HOW_TO_USE_LEADS: HowToUseGuide = {
  product: "Helix for Leads",
  title: "How to use",
  overview:
    "Score inbound leads 0–100, enrich contacts, and keep low-confidence items in HITL before CRM sync or outreach.",
  steps: [
    {
      title: "1. Watch the Dashboard",
      body: "Inbox health, lead quality, and review queue show where to spend time first.",
    },
    {
      title: "2. Work Leads and Inbox",
      body: "Open Leads for the full table/kanban. Use Inbox for HITL items that need approve or revise.",
    },
    {
      title: "3. Inspect score breakdown",
      body: "Check classification, tier, confidence, and enrichment before pushing to CRM.",
    },
    {
      title: "4. Tune scoring rules",
      body: "Settings → Scoring Rules and Prompt Playground control thresholds and agent behavior.",
    },
    {
      title: "5. Connect and measure",
      body: "Integrations for GHL/CRM, Analytics for source quality, Audit for score history.",
    },
  ],
  hitlTip:
    "Review queue items stay out of CRM until a human approves. Do not force-sync spam or low-confidence noise.",
  shortcuts: [
    { keys: "Filters", action: "Hot · Warm · Cold · Review · Spam on the Dashboard" },
    { keys: "Inbox", action: "HITL review queue" },
    { keys: "Analytics", action: "Hot-lead share by source" },
  ],
};

export type TourStepDef = {
  element: string;
  title: string;
  description: string;
};

export type EmptyStateCopy = {
  title: string;
  body: string;
  cta?: string;
};

export const TOUR_INBOX: TourStepDef[] = [
  {
    element: "[data-tour='inbox-metrics']",
    title: "Desk metrics",
    description: "Open, review, urgent, and blocked counts keep the EA focused on what matters first.",
  },
  {
    element: "[data-tour='inbox-queue']",
    title: "Triage queue",
    description: "Filter and select threads. Low-confidence items surface as Need review.",
  },
  {
    element: "[data-tour='inbox-ingest']",
    title: "Ingest thread",
    description: "Paste an inbound email to classify, score urgency, and draft a reply automatically.",
  },
  {
    element: "[data-tour='inbox-inspector']",
    title: "Active inspector",
    description: "Approve, route, regenerate, snooze, or block — every action is audited.",
  },
];

export const TOUR_LEGAL: TourStepDef[] = [
  {
    element: "[data-tour='legal-metrics']",
    title: "RFP pulse",
    description: "Pipeline volume, review load, and upcoming deadlines at a glance.",
  },
  {
    element: "[data-tour='legal-ingest']",
    title: "Ingest an RFP",
    description: "Drop or paste an RFP. Helix extracts fields with FACT cites and scores firm fit.",
  },
  {
    element: "[data-tour='legal-opportunities']",
    title: "Opportunities",
    description: "Review Go/No-Go, COI, pricing, and evidence before partner sign-off.",
  },
];

export const TOUR_LEADS: TourStepDef[] = [
  {
    element: "[data-tour='leads-metrics']",
    title: "Lead health",
    description: "Quality, review queue, and inbox health show where to spend time.",
  },
  {
    element: "[data-tour='leads-table']",
    title: "Lead list",
    description: "Score, classify, and open any lead for breakdown and HITL actions.",
  },
  {
    element: "[data-tour='leads-ingest']",
    title: "Score inbound",
    description: "Paste lead text to run the multi-agent pipeline with enrich and CRM-ready output.",
  },
];

export const EMPTY_INBOX = {
  queue: {
    title: "No threads in this view",
    body: "When mail arrives — or you ingest a sample — Helix will classify, score urgency, and draft a reply for HITL review.",
    cta: "Paste an email in Ingest thread to start.",
  },
  hitl: {
    title: "HITL queue is clear",
    body: "Low-confidence decisions will land here for approve, revise, or block. Nothing is sent without review when confidence is low.",
  },
  routed: {
    title: "No routed mail yet",
    body: "After you approve or route a thread, it appears here as a clean handoff history.",
  },
  blocked: {
    title: "No blocked mail",
    body: "Spam and filtered messages land here. Unblock anytime to return a thread to triage.",
  },
} as const satisfies Record<string, EmptyStateCopy>;

export const EMPTY_LEGAL = {
  opportunities: {
    title: "No RFPs yet",
    body: "Drop a PDF/DOCX or paste RFP text. Helix extracts cited fields, scores fit, and flags COI before you bid.",
    cta: "Use the ingest panel on the Dashboard.",
  },
} as const satisfies Record<string, EmptyStateCopy>;

export const EMPTY_LEADS = {
  list: {
    title: "No leads in this filter",
    body: "Ingest inbound text or wait for CRM sync. Helix scores 0–100 and parks low-confidence items in HITL.",
    cta: "Paste a lead on the Dashboard to score it.",
  },
} as const satisfies Record<string, EmptyStateCopy>;

export const SHORTCUTS_INBOX: HowToUseShortcut[] = [
  { keys: "?", action: "Open keyboard shortcuts" },
  { keys: "⌘K / Ctrl+K", action: "Focus queue filter" },
  { keys: "j / k", action: "Move selection down / up in the queue" },
  { keys: "Enter", action: "Focus the active inspector" },
  { keys: "r", action: "Regenerate smart reply (when a thread is selected)" },
];

export const SHORTCUTS_LEGAL: HowToUseShortcut[] = [
  { keys: "?", action: "Open keyboard shortcuts" },
  { keys: "⌘K / Ctrl+K", action: "Jump to opportunities" },
  { keys: "⌘B / Ctrl+B", action: "Collapse or expand the sidebar" },
];

export const SHORTCUTS_LEADS: HowToUseShortcut[] = [
  { keys: "?", action: "Open keyboard shortcuts" },
  { keys: "⌘K / Ctrl+K", action: "Focus search when available" },
  { keys: "/", action: "Focus lead filters on the Dashboard" },
];

export function tourDoneKey(product: "inbox" | "legal" | "leads") {
  return `helix-${product}-tour-v1-done`;
}

