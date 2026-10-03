export type PropertyStatus = "active" | "draft" | "reserved" | "sold";
export type PropertyKind = "apartment" | "house" | "penthouse" | "townhouse" | "loft";

export type Property = {
  id: string;
  title: string;
  address: string;
  zone: string;
  kind: PropertyKind;
  price: number;
  sqm: number;
  beds: number;
  baths: number;
  amenities: string[];
  status: PropertyStatus;
  daysOnMarket: number;
  description: string;
  /** Two hex colors for the placeholder cover until real photos are uploaded. */
  cover: [string, string];
};

export type Financing = "cash" | "preapproved" | "needs_financing" | "unknown";
export const LEAD_STAGES = ["new", "contacted", "visit", "offer", "closed", "archived"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];
export type Tier = "hot" | "warm" | "cold";

export type Lead = {
  id: string;
  name: string;
  email: string;
  /** International format, used only to open WhatsApp or the dialer on the agent's own device. */
  phone?: string;
  source: string;
  message: string;
  /** Maximum budget in USD. */
  budget: number;
  zones: string[];
  bedsMin: number;
  /** Months until the buyer wants to move, or null when not stated. */
  timelineMonths: number | null;
  financing: Financing;
  stage: LeadStage;
  createdAt: string;
  lastContactAt?: string;
  interestedIn?: string;
  notes: string[];
  /** Set only after HubSpot answered with a contact id. */
  crm?: { provider: "hubspot"; contactId: string; pushedAt: string };
};

export type ScoreFactor = { label: string; points: number; max: number; detail: string };
export type BuyerScore = { score: number; tier: Tier; confidence: number; factors: ScoreFactor[]; summary: string };

export type PropertyMatch = { property: Property; fit: number; reasons: string[]; concerns: string[] };

export type DraftKind = "new_match" | "reactivation";
export type DraftStatus = "pending" | "approved" | "dismissed";

/** One real send, recorded only after the provider answered with a message id. */
export type Delivery = { channel: "email" | "sms" | "whatsapp"; provider: "resend" | "twilio"; providerId: string; to: string; at: string; by: string };

/**
 * A message Helix wrote for the agent. It is sent only when the agent approves it and then confirms a send on a
 * connected channel (Resend or Twilio); otherwise the agent copies it into their own inbox.
 */
export type OutreachDraft = {
  id: string;
  kind: DraftKind;
  leadId: string;
  /** The listing that triggered a new-match alert, or the top suggestion in a reactivation. */
  propertyIds: string[];
  subject: string;
  body: string;
  /** Plain reasons the draft exists, shown as "Why this?". */
  why: string[];
  status: DraftStatus;
  createdAt: string;
  decidedBy?: string;
  decidedAt?: string;
  /** Who wrote the wording. The fit score and "why" are always computed by the desk. */
  writer?: "template" | "claude";
  /** Claude's plain-language reading of the computed fit, for the agent. */
  explanation?: string;
  /** "nightly" when the scheduled matching run queued it. */
  queuedBy?: "agent" | "nightly";
  deliveries?: Delivery[];
};

/** Listing copy the agent edited and approved. Helix doesn't publish it anywhere. */
export type ApprovedListingCopy = { propertyId: string; portal: string; social: string; message: string; writer: "template" | "claude"; approvedBy: string; approvedAt: string };

export type ShowingStatus = "scheduled" | "done" | "cancelled" | "no_show";
export const INTEREST_LEVELS = ["high", "medium", "low", "none"] as const;
export type Interest = (typeof INTEREST_LEVELS)[number];
export const COMMON_OBJECTIONS = ["Price", "Size", "Layout", "Location", "Condition", "Noise", "Light", "Parking", "Fees"] as const;

export type ShowingFeedback = { interest: Interest; objections: string[]; notes: string; recordedBy: string; recordedAt: string };

/** A visit on the agent's own calendar. Not synced to Google or Outlook; no invite is sent to anyone. */
export type Showing = {
  id: string;
  leadId: string;
  propertyId: string;
  startsAt: string;
  durationMin: number;
  status: ShowingStatus;
  checklist: { label: string; done: boolean }[];
  feedback?: ShowingFeedback;
  createdBy: string;
  createdAt: string;
};

export const SELLER_STAGES = ["prospect", "valuation", "agreement", "listed", "lost"] as const;
export type SellerStage = (typeof SELLER_STAGES)[number];

/** An owner on the listing side: a prospect Helix helps win, or the seller behind a listing already on the desk. */
export type Seller = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  source: string;
  address: string;
  zone: string;
  kind: PropertyKind;
  sqm: number;
  beds: number;
  /** What the owner hopes to get, in USD, or null when they haven't said. */
  askingPrice: number | null;
  stage: SellerStage;
  /** The desk listing for this seller's property, once there is one. */
  propertyId?: string;
  notes: string;
  createdAt: string;
  lastContactAt?: string;
};

/** One thing that actually happened on the desk through a Helix action. Kept in memory with the desk. */
export type ActivityEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  /** "run" = executed, "undo" = reverted, "proposed" = Helix asked a person first. */
  kind: "run" | "undo" | "proposed";
  via: "button" | "chat" | "schedule";
  labels: string[];
  done: number;
  failed: number;
};

export type MarketZone = {
  id: string;
  name: string;
  avgPricePerSqm: number;
  medianDaysOnMarket: number;
  yoyChangePct: number;
  activeListings: number;
  /** Monthly values, oldest first, ending with the current figure. */
  trend?: { perSqm: number[]; daysOnMarket: number[] };
  /** Every market figure on the demo desk is sample data and must be labelled as such. */
  source: "demo";
};
