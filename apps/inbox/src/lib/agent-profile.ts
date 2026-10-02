export const INBOX_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
  { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
] as const;

export type InboxModelId = (typeof INBOX_MODELS)[number]["id"];

export type InboxPersona = "executive" | "sales";

type Profile = {
  model: InboxModelId;
  prompt: string;
  persona: InboxPersona;
  followUpHours: number;
  quoteApprovalUsd: number;
  discountApprovalPct: number;
};

let profile: Profile = {
  model: "claude-sonnet-4-20250514",
  prompt: "",
  persona: "executive",
  followUpHours: 48,
  quoteApprovalUsd: 5000,
  discountApprovalPct: 15,
};

export function getAgentProfile(): Profile {
  return profile;
}

export function setAgentProfile(next: Partial<Profile>): Profile {
  const model = INBOX_MODELS.some((m) => m.id === next.model) ? (next.model as InboxModelId) : profile.model;
  const persona = next.persona === "sales" || next.persona === "executive" ? next.persona : profile.persona;
  const followUpHours = Number.isFinite(next.followUpHours) ? Math.min(24 * 14, Math.max(1, Number(next.followUpHours))) : profile.followUpHours;
  const quoteApprovalUsd = Number.isFinite(next.quoteApprovalUsd) ? Math.max(0, Number(next.quoteApprovalUsd)) : profile.quoteApprovalUsd;
  const discountApprovalPct = Number.isFinite(next.discountApprovalPct)
    ? Math.min(100, Math.max(0, Number(next.discountApprovalPct)))
    : profile.discountApprovalPct;
  profile = {
    model,
    persona,
    followUpHours,
    quoteApprovalUsd,
    discountApprovalPct,
    prompt: next.prompt != null ? next.prompt.slice(0, 4000) : profile.prompt,
  };
  return profile;
}

const MONEY_RE = /\$?\d[\d,]*(?:\.\d+)?/g;

export function maxAmountIn(text: string): number {
  const amounts = [...text.matchAll(MONEY_RE)].map((m) => Number(m[0].replace(/[$,]/g, "")));
  return amounts.reduce((max, n) => (Number.isFinite(n) ? Math.max(max, n) : max), 0);
}

function maxDiscountPct(text: string): number {
  if (!/discount|descuento|% off|percent off/.test(text)) return 0;
  const pcts = [...text.matchAll(/(\d+(?:\.\d+)?)\s*%/g)].map((m) => Number(m[1]));
  return pcts.reduce((max, n) => (Number.isFinite(n) ? Math.max(max, n) : max), 0);
}

/** Hard rules Ask Helix cannot break: large quotes, and discounts over the admin cap. */
export function guardrailReason(input: { subject: string; body: string; draft?: string }): string | null {
  const hay = `${input.subject}\n${input.body}\n${input.draft ?? ""}`.toLowerCase();
  const discount = maxDiscountPct(hay);
  if (discount > profile.discountApprovalPct) {
    return `Guardrail: a discount above ${profile.discountApprovalPct}% needs a person to press Send.`;
  }
  const commercial = /quote|quotation|contract|pricing|invoice|cotizaci[oó]n/.test(hay);
  if (!commercial) return null;
  const amount = maxAmountIn(hay);
  if (amount < profile.quoteApprovalUsd) return null;
  return `Guardrail: ${profile.quoteApprovalUsd.toLocaleString("en-US", { style: "currency", currency: "USD" })}+ quote or contract needs a person to press Send.`;
}

export function cycleInboxModel(): Profile {
  const idx = INBOX_MODELS.findIndex((m) => m.id === profile.model);
  const next = INBOX_MODELS[(idx + 1) % INBOX_MODELS.length];
  return setAgentProfile({ model: next.id });
}
