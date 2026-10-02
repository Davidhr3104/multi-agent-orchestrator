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
    "Score orders for fraud, flag restock risks, and fulfill or cancel on Shopify after human review when Admin keys are set.",
  videoSrc: "/help/helix-commerce-howto.mp4",
  videoTitle: "Product walkthrough (~1m 45s)",
  steps: [
    {
      title: "1. Open the Dashboard",
      body: "Scan revenue, fulfillment, and restock alerts. Live orders show which tickets need HITL review first.",
    },
    {
      title: "2. Ask Helix AI",
      body: "Click Ask Helix to open the assistant panel and work in plain language, or keep using the screens — both do the same thing. Ask which orders look risky, or give orders: \"Hold order #1003\", \"Approve order #1002\", \"Restock the drone kit\". Safe, reversible changes (holding an order, drafting a reorder, approving a clean low-risk order) run right away with an Undo button. Cancelling an order, or approving a risky or real Shopify order, stops and asks you first — those cannot be taken back on Shopify.",
    },
    {
      title: "3. Work Orders with the inspector",
      body: "Select an order to see fraud score, reasoning, and customer context. Approve, flag, or cancel from HITL Review.",
    },
    {
      title: "4. Products and Inventory",
      body: "Browse catalog health, then use Inventory for reorder recommendations before stockouts hit the storefront.",
    },
    {
      title: "5. Customers and Analytics",
      body: "Review customer signals and Analytics charts for revenue and risk trends across the desk.",
    },
    {
      title: "6. Settings and Sync",
      body: "Confirm Shopify, Claude, and Supabase in Settings. Paste API keys there instead of editing .env. Until you connect Shopify the desk shows a sample store (Reset demo restores it); connecting switches it to your real orders. Use Sync Shopify when credentials are configured; HITL approve fulfills, cancel voids the order on Shopify.",
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

export const HOW_TO_USE_MARKETING: HowToUseGuide = {
  product: "Helix for Marketing",
  title: "How to use",
  overview:
    "Join ad spend to Helix lead scores. Rec recommends pause / scale / keep. You confirm locally. This is not Ads Manager and not a post generator.",
  steps: [
    {
      title: "1. Read the table",
      body: "Each row is a campaign in the selected window (7d / 30d / 90d): spend, form volume, average score, cost per hot lead, and the REC action. Windows cut dated spend and leads — they are not the same snapshot.",
    },
    {
      title: "2. Ask Helix AI",
      body: "Click Ask Helix to open the assistant panel and work in plain language, or keep using the screens — both do the same thing. Ask where spend is wasted, or give orders: \"Keep Ad D\", \"Pause Ad A\", \"Scale Ad B\". Keeping a campaign is local and runs right away with an Undo. Pausing or scaling changes live ad delivery, so Helix AI always asks you to confirm first, and Ads Manager is only updated when Meta is connected.",
    },
    {
      title: "3. Check the catalog example",
      body: "Ad A (volume, low score) should recommend pause. Ad B (quality, affordable hot leads) should recommend scale. Ad C may drop out of 7d if its scored leads sit outside that window.",
    },
    {
      title: "4. HITL",
      body: "Open HITL or a campaign and Confirm pause, Confirm scale, or Keep. Status is local only — Meta/Google stay stubs. Decisions persist in the desk file (and Supabase when configured).",
    },
    {
      title: "5. Join queue",
      body: "Spend whose campaign_id has no scored leads does not get a fake score. It lands on Join queue as unmatched.",
    },
    {
      title: "6. Ingest CSV",
      body: "Paste spend with campaign_id, name, platform, spend, form_leads. Optional date column (YYYY-MM-DD). Joins against scored leads by campaign_id.",
    },
    {
      title: "7. Settings",
      body: "Paste Anthropic and Supabase keys in Settings. Until you connect Meta Ads the desk shows sample campaigns (Reset demo restores them); connecting switches it to your real spend. CSV is the live spend path. Meta and Google tokens can be saved as stubs — they do not write to Ads Manager.",
    },
  ],
  hitlTip:
    "Do not treat Confirm pause as a live Ads Manager write. Evidence first, human second, API later.",
  shortcuts: [
    { keys: "pause / scale / keep", action: "Filter REC actions" },
    { keys: "review", action: "HITL queue" },
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
      body: "Scan metrics for open threads, need-review, urgent, and blocked. Use filters, or ⌘K for snooze, assign, and approve.",
    },
    {
      title: "2. Ask Helix AI",
      body: "Click Ask Helix to open the assistant panel and work in plain language, or keep using the screens — both do the same thing. Ask what is urgent, or give orders: \"Draft a reply to Maya Chen\", \"Snooze Priya Shah's email\", \"Archive the HVAC Weekly newsletter\". Drafts, snoozes and archives of low-urgency mail run right away with an Undo. Sending an email, or touching something urgent or still awaiting your review, always stops and asks you first.",
    },
    {
      title: "3. Ingest or wait for triage",
      body: "Paste an email into Ingest thread, or enable auto-triage in Settings so new mail is classified automatically.",
    },
    {
      title: "4. Work the HITL queue",
      body: "Open HITL queue for low-confidence decisions. Select a thread to see category, route target, reasoning, and draft.",
    },
    {
      title: "5. Act in the inspector",
      body: "Send reply uses Resend (fails without keys). Mark routed is a local handoff only. Sync Gmail when a token is pasted in Settings.",
    },
    {
      title: "6. Tune preferences",
      body: "In Settings, paste Claude / Resend keys, then set reply tone, VIP senders, and theme. Until you connect Gmail the desk shows sample Northwind threads; connecting a mailbox switches it to your real mail. Routed and Blocked views keep a clean history.",
    },
  ],
  hitlTip:
    "Anything marked Need review stays in HITL until you approve or block. Prefer review when confidence is low rather than auto-sending.",
  shortcuts: [
    { keys: "⌘K / Ctrl+K", action: "Command palette: snooze, assign, approve & send" },
    { keys: "J / K", action: "Move through the dashboard queue" },
    { keys: "Filters", action: "All · Urgent · Needs Review on the Dashboard" },
    { keys: "Theme toggle", action: "Switch light / dark from the header" },
  ],
};

export const HOW_TO_USE_LEGAL: HowToUseGuide = {
  product: "Helix for Legal",
  title: "How to use",
  overview:
    "Turn messy RFPs into cited extracted fields, Go/No-Go, COI checks, pricing posture, and proposal packs with human oversight.",
  videoSrc: "/help/helix-legal-howto.mp4",
  videoTitle: "Product walkthrough (~60s)",
  steps: [
    {
      title: "1. Start on the Dashboard",
      body: "Drop or paste an RFP. Helix extracts fields with FACT cites, then scores fit against your firm profile.",
    },
    {
      title: "2. Ask Helix AI",
      body: "Click Ask Helix to open the assistant panel and work in plain language, or keep using the screens — both do the same thing. Ask about scores, deadlines and what needs attention, or give orders: \"Run a conflict check on the SPI coding RFP\", \"Prepare a fee quote for the County IT RFP\", \"Add a note to the SPI RFP: …\", \"Send the Clinical NLP RFP to partner review\". Safe changes run right away with an Undo button (reports and quotes only compute, so they have nothing to undo). A GO / CONDITIONAL / NO-GO is always a partner's call: Helix AI asks you to confirm it and stamps it \"Helix AI · approved by you\" in the Audit log.",
    },
    {
      title: "3. Review Opportunities",
      body: "Open each opportunity to inspect evidence spans, deadlines, compliance gaps, and competitive notes.",
    },
    {
      title: "4. Resolve Go/No-Go and COI",
      body: "Confirm or override the pursuit verdict. Clear conflict signals before committing partner time.",
    },
    {
      title: "5. Pricing and documents",
      body: "Use Pricing for fee posture, Documents for packs, and Deadlines so nothing slips past ISO dates.",
    },
    {
      title: "6. Settings and Audit",
      body: "Paste Anthropic and Supabase keys in Settings, then keep the client profile accurate. The desk starts with sample RFPs under a Demo data label; Use my own data clears them for good. Audit Log records AI decisions and human overrides.",
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
      title: "2. Ask Helix AI",
      body: "Click Ask Helix to open the assistant panel and work in plain language, or keep using the screens — both do the same thing. Ask questions (\"Why did Jordan Hale score 96?\") or give orders (\"Move Jordan Hale to contacted\", \"Clean up my stale leads\", \"Add a note to Maya Chen: sent pricing\"). Safe, reversible changes run right away with an Undo button. Anything risky — approving the review queue, archiving a high-score or bulk set of leads, moving a lead still awaiting review — stops and asks you first. Every AI change is stamped \"Helix AI · approved by you\" in the Audit log.",
    },
    {
      title: "3. Work Leads and Inbox",
      body: "Open Leads for the full table/kanban. Use Inbox for HITL items that need approve or revise.",
    },
    {
      title: "4. Inspect score breakdown",
      body: "Check classification, tier, confidence, and enrichment before pushing to CRM.",
    },
    {
      title: "5. Tune scoring rules",
      body: "Settings → Scoring Rules and Prompt Playground control thresholds and agent behavior.",
    },
    {
      title: "6. Connect and measure",
      body: "Until you connect GoHighLevel the desk shows sample leads under a Demo data banner (Reset demo restores them). Settings → paste GHL/CRM keys and it switches to your real leads. Analytics for source quality, Audit for score history.",
    },
  ],
  hitlTip:
    "Review queue items stay out of CRM until a human approves. Do not force-sync spam or low-confidence noise. Helix AI follows the same rule: it never approves the review queue on its own.",
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
  /** Where the popover sits relative to the element; defaults to below. */
  side?: "top" | "right" | "bottom" | "left";
};

export type TourProduct = "inbox" | "legal" | "leads" | "commerce" | "marketing" | "social" | "real-estate";

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
    element: "[data-tour='leads-ask']",
    title: "Ask Helix AI",
    description: "Ask why a lead scored the way it did or what changed in the pipeline. Answers come from your desk's leads and logs.",
  },
  {
    element: "[data-tour='leads-attention']",
    title: "Needs your review",
    description: "Leads the engine isn't sure about wait here. Approve to push to your CRM (only when GoHighLevel is connected) or mark as spam.",
  },
  {
    element: "[data-tour='leads-kpis']",
    title: "Pipeline health",
    description: "Volume, quality and the review queue, counted from the leads on this desk.",
  },
  {
    element: "[data-tour='leads-priority']",
    title: "Priority list",
    description: "Best-scored leads first. Open any lead for its 0–100 score breakdown.",
  },
  {
    element: "[data-tour='leads-feed']",
    title: "Webhook feed",
    description: "Every inbound lead and sync event as it happens. Try Simulate Webhook at the top to see one arrive.",
  },
];

export const TOUR_COMMERCE: TourStepDef[] = [
  {
    element: "[data-tour='commerce-metrics']",
    title: "Store pulse",
    description: "Orders, revenue, low-stock items and dollars at risk — counted from your orders (a sample store until Shopify is connected).",
  },
  {
    element: "[data-tour='commerce-ask']",
    title: "Ask Helix AI",
    description: "Ask why an order scored the way it did. Answers are grounded in that order's fraud reasoning.",
  },
  {
    element: "[data-tour='commerce-orders']",
    title: "Live orders",
    description: "Every order gets a fraud score. Filter by High risk, Review or Clean, then click a row to inspect it.",
  },
  {
    element: "[data-tour='commerce-inspector']",
    title: "Order inspector",
    description: "See the customer, items, address and fraud reasons, then decide: Approve or Refund & Cancel. The decision is yours.",
    side: "left",
  },
  {
    element: "[data-tour='commerce-restock']",
    title: "Restock queue",
    description: "Products projected to run out within 14 days. Quick Restock PO records a purchase order on the desk for you to follow up.",
    side: "top",
  },
];

export const TOUR_MARKETING: TourStepDef[] = [
  {
    element: "[data-tour='marketing-ask']",
    title: "Ask Helix AI",
    description: "Ask what spend on spam means, how waste is calculated or when to pause a campaign.",
  },
  {
    element: "[data-tour='marketing-kpis']",
    title: "Spend at a glance",
    description: "Spend, lead quality and waste for the selected window — from the spend you imported and your scored leads.",
  },
  {
    element: "[data-tour='marketing-chart']",
    title: "Spend vs lead quality",
    description: "Each bubble is a campaign: what it spent against the average Helix score of its leads. Bubble size is form volume.",
  },
  {
    element: "[data-tour='marketing-campaigns']",
    title: "Campaigns",
    description: "Helix recommends pause, scale or keep with the evidence. A person confirms every pause or scale.",
    side: "top",
  },
  {
    element: "[data-tour='marketing-ingest']",
    title: "Import spend",
    description: "Drop a CSV — it always works. Meta sync needs keys in Settings; Google and TikTok stay local.",
    side: "left",
  },
];

export const TOUR_SOCIAL: TourStepDef[] = [
  {
    element: "[data-tour='social-ask']",
    title: "Ask Helix AI",
    description: "Ask what's waiting for review, why a post isn't ready or what goes out this week. Helix can send posts back or move them — approving always waits for you.",
  },
  {
    element: "[data-tour='social-balance']",
    title: "Pillar balance",
    description: "How the planned calendar splits across your content pillars. A quiet pillar is called out under its bar.",
  },
  {
    element: "[data-tour='social-kpis']",
    title: "Key numbers",
    description: "What's waiting for review, ready to approve, approved and planned this week. Nothing is published from here.",
  },
  {
    element: "[data-tour='social-queue']",
    title: "Approval queue",
    description: "Every draft waits for a person. Approving marks it ready — posting to the networks isn't connected.",
    side: "top",
  },
  {
    element: "[data-tour='social-week']",
    title: "Next 7 days",
    description: "Everything planned this week, whatever its status. Open the calendar to move or edit posts.",
    side: "top",
  },
];

export const TOUR_REAL_ESTATE: TourStepDef[] = [
  {
    element: "[data-tour='re-nav']",
    title: "Your desk",
    description: "Properties, buyers, showings, outreach and sellers. Red badges count what's waiting for you. Collapse the sidebar to icons from the top.",
    side: "right",
  },
  {
    element: "[data-tour='re-ask']",
    title: "Ask Helix AI",
    description: "Ask about buyers, listings and matches. Helix proposes actions — you approve each one, and most can be undone.",
  },
  {
    element: "[data-tour='re-kpis']",
    title: "Key numbers",
    description: "Active listings, open buyers, hot buyers and average score, counted from this desk.",
  },
  {
    element: "[data-tour='re-today']",
    title: "Today & outreach",
    description: "Showings left today and drafts waiting for your approval. Nothing is sent to buyers from Helix.",
  },
  {
    element: "[data-tour='re-hot']",
    title: "Hottest buyers",
    description: "Filter by stage and budget. The dot on each avatar shows how recently you were in touch.",
    side: "top",
  },
  {
    element: "[data-tour='re-market']",
    title: "Market snapshot",
    description: "Sample market figures for each zone next to the numbers from your own listings.",
    side: "left",
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

export function tourDoneKey(product: TourProduct) {
  return `helix-${product}-tour-v1-done`;
}

