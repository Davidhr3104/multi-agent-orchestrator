import { completeWithClaude, isClaudeConfigured, parseJsonObject } from "../claude";
import { inferIndustry } from "./intelligence";

export type DomainEnrichment = {
  estimated_industry: string | null;
  estimated_company_size: string | null;
  country: string | null;
};

export function domainFromEmail(email: string): string | null {
  const host = email.split("@")[1]?.toLowerCase() ?? "";
  if (!host || /gmail|yahoo|hotmail|outlook|icloud|example|spam|invalid/.test(host)) return null;
  return host;
}

export async function enrichEmailDomain(email: string): Promise<DomainEnrichment | null> {
  const domain = domainFromEmail(email);
  if (!domain) return null;
  const fallback: DomainEnrichment = {
    estimated_industry: inferIndustry({ name: "", email, message: domain }),
    estimated_company_size: "11-50",
    country: null,
  };
  if (!isClaudeConfigured()) return fallback;
  try {
    const text = await completeWithClaude(
      `Analyze the domain ${domain}. Return ONLY JSON: {"estimated_industry": string|null, "estimated_company_size": "1-10"|"11-50"|"50-200"|"200+"|null, "country": string|null}. If unknown, use null. No prose.`,
      400
    );
    const parsed = text ? parseJsonObject<DomainEnrichment>(text) : null;
    if (!parsed) return fallback;
    return {
      estimated_industry: parsed.estimated_industry ?? fallback.estimated_industry,
      estimated_company_size: parsed.estimated_company_size ?? fallback.estimated_company_size,
      country: parsed.country ?? null,
    };
  } catch {
    return fallback;
  }
}
