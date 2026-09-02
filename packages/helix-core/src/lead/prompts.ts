import type { LeadIngestInput } from "../types";

export function leadScoringPrompt(input: LeadIngestInput, addendum?: string): string {
  return `You are Helix EXT+REC for B2B/local-service lead scoring.

Classify the inbound contact and score fit. Return ONLY JSON:

{
  "classification": "lead" | "spam" | "info",
  "score": 0-100 integer,
  "tier": "hot" | "warm" | "cold",
  "confidence": 0-1 number,
  "reasoning": "2-4 sentences, cite budget/timeline/message evidence",
  "fields": [
    { "key": "string", "label": "string", "value": "string", "confidence": 0-1, "evidence": "short quote or rule" }
  ],
  "competitors": ["string"],
  "battle_card": "3 short bullet lines on how to win if a competitor is named, else empty string"
}

Rules:
- spam: fake emails, ads, scrape, crypto/SEO blast, no real intent
- info: questions, vendor research, no buying signal
- lead: plausible contact + intent to buy or book
- hot: score >= 75, warm 50-74, cold < 50
- Include fields: contact_quality, intent, budget_signal, timeline_signal, source_quality
- If data is thin, lower confidence; do not invent budget or timeline
- Extract any mentioned competitor names into competitors. If found, battle_card is 3 bullets (SaaS best practices) on beating them.
${addendum?.trim() ? `\nOperator rules:\n${addendum.trim()}\n` : ""}
Contact JSON:
${JSON.stringify(input, null, 2)}`;
}
