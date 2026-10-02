export type Channel = "instagram" | "linkedin" | "x" | "tiktok" | "facebook";

/**
 * draft          AI or a teammate wrote it; not yet sent for sign-off
 * needs_review   waiting for a person to approve or send back
 * changes        a person sent it back with notes
 * approved       a person signed off; it is queued for its date
 * published      went out (only possible once the channel is connected)
 */
export type PostStatus = "draft" | "needs_review" | "changes" | "approved" | "published";

export type Pillar = "product" | "behind_the_scenes" | "education" | "community" | "promo";

export type DeskRole = "creator" | "client" | "admin";

export type Comment = {
  id: string;
  actor: string;
  role: DeskRole;
  body: string;
  at: string;
};

/** Caption before a rewrite or a manual edit, so the team can see what changed. */
export type Revision = {
  id: string;
  at: string;
  actor: string;
  summary: string;
  caption: string;
};

export type MediaItem = {
  id: string;
  kind: "image" | "video";
  label: string;
  url: string;
  source: "upload" | "stock";
};

export type Post = {
  id: string;
  channel: Channel;
  pillar: Pillar;
  /** ISO timestamp of the planned slot. */
  scheduledFor: string;
  caption: string;
  hashtags: string[];
  /** What visual the post needs. */
  asset: string;
  status: PostStatus;
  createdBy: "helix_ai" | "team";
  notes: string[];
  comments?: Comment[];
  revisions?: Revision[];
  media?: MediaItem[];
  /** Set when this draft was generated from another channel's post. */
  sourcePostId?: string;
  /** First sign-off when the workspace requires a client after the manager. */
  internalSignOff?: { by: string; at: string };
  approvedBy?: string;
  approvedAt?: string;
};

export type AccessRole = "owner" | "manager" | "creator" | "client";
export type ApprovalMode = "manager" | "manager_then_client";
export type PlanId = "starter" | "pro";

export type LibraryAsset = {
  id: string;
  name: string;
  kind: "image" | "video" | "logo" | "prompt";
  url: string;
  folder: string;
  tags: string[];
  approved: boolean;
  prompt?: string;
};

export type Member = { id: string; name: string; role: AccessRole };

export type WebhookEndpoint = { id: string; url: string; events: string[] };

export type WebhookDelivery = { id: string; at: string; event: string; payload: Record<string, unknown> };

export type ExecutiveReport = {
  id: string;
  createdAt: string;
  workspaceName: string;
  total: number;
  approved: number;
  perfect: number;
  avgScore: number;
  pillars: { pillar: Pillar; count: number; avgScore: number }[];
  note: string;
};

export type Brand = {
  name: string;
  handle: string;
  voice: string[];
  /** Words the brand never uses in copy. */
  avoid: string[];
  /** Standing instructions for the co-pilot. Lines may start with "always:" or "never:". */
  directives: string;
  channels: Channel[];
};

export type ReadinessFactor = { label: string; points: number; max: number; detail: string };
export type Readiness = { score: number; ready: boolean; factors: ReadinessFactor[]; summary: string };
