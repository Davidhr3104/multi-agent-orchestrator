import type { RfpIngestInput } from "@helix/core";
import type { StructuredProfile } from "@/lib/client-profile";
import type { SamRfpSource } from "@/lib/legal-rfp";
import { SAM_PROCUREMENT_TYPES, type SamDescriptionResult, type SamOpportunity } from "@/lib/sam-gov";

export const SAM_ID_PREFIX = "sam-";
/** NAICS 541110 "Offices of Lawyers" — the federal code for legal-services buys. */
export const LEGAL_SERVICES_NAICS = "541110";

const STATE_CODES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA", colorado: "CO",
  connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
  illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS", kentucky: "KY", louisiana: "LA",
  maine: "ME", maryland: "MD", massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", ohio: "OH",
  oklahoma: "OK", oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT", virginia: "VA",
  washington: "WA", "west virginia": "WV", wisconsin: "WI", wyoming: "WY", "district of columbia": "DC",
};

const PRACTICE_KEYWORDS: Record<string, string[]> = {
  "Personal injury": ["legal services", "litigation support"],
  "Medical malpractice": ["medical record review", "medical malpractice"],
  "Workers' compensation": ["workers compensation"],
  "Clinical analysis / BEAR": ["medical record review", "clinical review"],
  "SPI coding": ["medical coding"],
  "Mass tort": ["litigation support"],
};

export type SamProfileFilters = {
  ncode: string;
  state?: string;
  title?: string;
  ptype?: string;
  suggestedKeywords: string[];
  rationale: string[];
};

export function samRfpId(noticeId: string): string {
  return `${SAM_ID_PREFIX}${noticeId.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 64)}`;
}

export function stateCodeFor(jurisdiction: string): string | undefined {
  const j = jurisdiction.trim().toLowerCase();
  if (/^[a-z]{2}$/.test(j) && Object.values(STATE_CODES).includes(j.toUpperCase())) return j.toUpperCase();
  return STATE_CODES[j];
}

/** Search filters the firm profile supports. Only what the profile actually states is applied. */
export function samFiltersFromProfile(profile: StructuredProfile): SamProfileFilters {
  const rationale = [`NAICS ${LEGAL_SERVICES_NAICS} (Offices of Lawyers): federal legal-services buys.`];
  const state = stateCodeFor(profile.jurisdiction);
  if (state) rationale.push(`Place of performance ${state}, from the profile jurisdiction "${profile.jurisdiction}".`);
  else rationale.push(`Jurisdiction "${profile.jurisdiction}" is not a single state, so no state filter.`);
  const suggestedKeywords = [
    ...new Set(profile.practiceAreas.flatMap((area) => PRACTICE_KEYWORDS[area] ?? [])),
  ];
  if (suggestedKeywords.length) {
    rationale.push("Title keywords from practice areas are suggestions (SAM.gov takes one keyword per search).");
  }
  return { ncode: LEGAL_SERVICES_NAICS, state, suggestedKeywords, rationale };
}

export function agencyFromOpportunity(op: SamOpportunity): string {
  const path = op.fullParentPathName?.trim();
  if (path) {
    return path
      .split(".")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" / ");
  }
  return [op.department, op.subTier ?? op.subtier, op.office].filter((s) => s && String(s).trim()).join(" / ") || "Unspecified agency";
}

function placeLabel(op: SamOpportunity): string | undefined {
  const p = op.placeOfPerformance;
  if (!p) return undefined;
  const parts = [p.city?.name, p.state?.code ?? p.state?.name, p.country?.code].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function clean(v: string | null | undefined): string | undefined {
  const s = v == null ? "" : String(v).trim();
  return s && s.toLowerCase() !== "null" ? s : undefined;
}

export type MappedSamRfp = {
  id: string;
  input: RfpIngestInput;
  source: SamRfpSource;
};

/**
 * Turns one SAM.gov notice into the desk's RFP input. The body is written only from SAM.gov fields and the
 * notice description, so every citation points at text SAM.gov published.
 */
export function mapSamOpportunity(
  op: SamOpportunity,
  opts: { description?: SamDescriptionResult; importedVia: "manual" | "cron"; importedAt?: string; clientProfile?: string }
): MappedSamRfp | null {
  const noticeId = clean(op.noticeId);
  const title = clean(op.title);
  if (!noticeId || !title) return null;

  const agency = agencyFromOpportunity(op);
  const deadline = clean(op.responseDeadLine) ?? clean(op.reponseDeadLine);
  const setAside = clean(op.typeOfSetAsideDescription) ?? clean(op.setAside);
  const noticeType = clean(op.type) ?? clean(op.baseType);
  const naics = clean(op.naicsCode);
  const place = placeLabel(op);
  const posted = clean(op.postedDate) ?? "";
  const solicitationNumber = clean(op.solicitationNumber);
  const publicUrl = `https://sam.gov/opp/${encodeURIComponent(noticeId)}/view`;
  const uiLink = clean(op.uiLink) ?? publicUrl;
  const resourceLinks = (op.resourceLinks ?? []).filter((l): l is string => typeof l === "string" && /^https:\/\//.test(l));

  const description = opts.description;
  const descriptionStatus: SamRfpSource["descriptionStatus"] = description ? description.status : "not_fetched";
  const descriptionNote =
    description?.status === "unavailable"
      ? description.reason
      : description?.status === "failed"
        ? description.error.message
        : undefined;

  const lines = [
    `Title: ${title}`,
    `Agency: ${agency}`,
    `Notice ID: ${noticeId}`,
    solicitationNumber ? `Solicitation number: ${solicitationNumber}` : null,
    noticeType ? `Notice type: ${noticeType}` : null,
    posted ? `Posted: ${posted}` : null,
    deadline ? `Response deadline: ${deadline}` : "Response deadline: not stated on SAM.gov",
    naics ? `NAICS: ${naics}` : null,
    setAside ? `Set-aside: ${setAside}` : null,
    place ? `Place of performance: ${place}` : null,
    `Source: ${uiLink}`,
    "",
    description?.status === "fetched"
      ? `Description:\n${description.text}`
      : `Description: not available (${descriptionNote ?? "not fetched in this import"}). Read the full notice on SAM.gov.`,
  ].filter((l): l is string => l !== null);

  return {
    id: samRfpId(noticeId),
    input: { title, issuer: agency, body: lines.join("\n"), clientProfile: opts.clientProfile },
    source: {
      kind: "sam.gov",
      noticeId,
      solicitationNumber,
      uiLink,
      publicUrl,
      agency,
      postedDate: posted,
      responseDeadline: deadline,
      naics,
      setAside,
      noticeType,
      placeOfPerformance: place,
      resourceLinks,
      descriptionStatus,
      descriptionNote,
      importedAt: opts.importedAt ?? new Date().toISOString(),
      importedVia: opts.importedVia,
    },
  };
}

export function procurementTypeLabel(ptype: string | undefined): string {
  return ptype ? (SAM_PROCUREMENT_TYPES[ptype] ?? ptype) : "All notice types";
}
