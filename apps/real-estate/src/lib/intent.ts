import type { Lead } from "./types";

export const INTENTS = ["investor", "end_buyer", "tenant", "unclear"] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABEL: Record<Intent, string> = { investor: "Investor", end_buyer: "End buyer", tenant: "Tenant", unclear: "Unclear" };

const INVESTOR = /\b(invest(or|ment|ing)?|rental[- ]ready|rent (it|them) out|yield|portfolio|units|cash ?flow|roi)\b/i;
const TENANT = /\b(to rent|for rent|renting|lease|leasing|tenant|monthly rent)\b/i;
const END_BUYER = /\b(family|relocat\w*|move|moving|first[- ]time|our (home|flat|house)|downsiz\w*|baby|kids|school|dog|live|starter home|bedrooms?)\b/i;

/**
 * Keyword rules over the buyer's own message — no model, no outside data. The matched phrase is returned so
 * the UI can show why a buyer got the label, and anything without a clear signal stays "Unclear".
 */
export function intentFor(lead: Pick<Lead, "message">): { intent: Intent; why: string } {
  const m = lead.message;
  const hit = (re: RegExp) => re.exec(m)?.[0];
  const inv = hit(INVESTOR);
  if (inv) return { intent: "investor", why: `Message mentions “${inv}”` };
  const ten = hit(TENANT);
  if (ten) return { intent: "tenant", why: `Message mentions “${ten}”` };
  const end = hit(END_BUYER);
  if (end) return { intent: "end_buyer", why: `Message mentions “${end}”` };
  return { intent: "unclear", why: "No clear signal in the message yet" };
}
