import type { RfpIngestInput } from "../types";

export const DEFAULT_LEGAL_PROFILE =
  "Injury law firm. We bid on medical-record and clinical-analysis RFPs (BEAR or SPI). Sweet spot $25k-$150k, US jurisdiction. Skip pure software/IT unless the work is clinical NLP or chart review.";

export function rfpScoringPrompt(input: RfpIngestInput): string {
  const profile = input.clientProfile?.trim() || DEFAULT_LEGAL_PROFILE;
  return `You are Helix EXT+FACT+REC for legal RFP intake.

Extract fields from the RFP body. Do not invent deadlines or dollar amounts. If a value is not in the text, set it unverified and lower confidence.

Return ONLY JSON:
{
  "method": "BEAR" | "SPI" | "other",
  "amount": "string as written or unspecified",
  "deadline": "string as written or unspecified",
  "matchScore": 0-100 integer,
  "tier": "hot" | "warm" | "cold",
  "confidence": 0-1 number,
  "reasoning": "2-4 sentences citing evidence",
  "fields": [
    { "key": "string", "label": "string", "value": "string", "confidence": 0-1, "quote": "exact substring from the RFP", "spanStart": 0, "spanEnd": 10, "evidence": "chars start-end" }
  ]
}

FACT: every extracted value must be a verbatim span from the RFP (quote + spanStart/spanEnd). If missing, quote empty, spanStart -1, do not invent.

Include fields: issuer, deadline, amount, method, requirements, jurisdiction, fit.
Match the client profile. hot >= 75, warm 50-74, cold < 50.

Client profile:
${profile}

RFP:
${JSON.stringify({ title: input.title, issuer: input.issuer, body: input.body }, null, 2)}`;
}
