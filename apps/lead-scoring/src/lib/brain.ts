import type { ScoreThresholds } from "@helix/core";

export type BrainGates = {
  webmail: boolean;
  gibberish: boolean;
  blacklist: boolean;
};

export type BrainAutomations = {
  vip: boolean;
  hitl: boolean;
  spam: boolean;
  nurture: boolean;
};

export type BrainSettings = {
  addendum: string;
  hitl: number;
  gates: BrainGates;
  automations: BrainAutomations;
  /** Rule ids that are OFF in Scoring Settings (persisted for desk sync). */
  disabledRuleIds: string[];
  thresholds: ScoreThresholds;
};

const DEFAULT_GATES: BrainGates = {
  webmail: true,
  gibberish: true,
  blacklist: true,
};

const DEFAULT_AUTOMATIONS: BrainAutomations = {
  vip: true,
  hitl: true,
  spam: true,
  nurture: true,
};

const DEFAULT_THRESHOLDS: ScoreThresholds = {
  autoQualifyScore: 80,
  dqScore: 50,
  vipScore: 90,
  nurtureMin: 30,
  nurtureMax: 65,
};

const DEFAULT: BrainSettings = {
  addendum: "",
  hitl: 0.65,
  gates: { ...DEFAULT_GATES },
  automations: { ...DEFAULT_AUTOMATIONS },
  disabledRuleIds: [],
  thresholds: { ...DEFAULT_THRESHOLDS },
};

let brain: BrainSettings = {
  ...DEFAULT,
  gates: { ...DEFAULT_GATES },
  automations: { ...DEFAULT_AUTOMATIONS },
  disabledRuleIds: [],
  thresholds: { ...DEFAULT_THRESHOLDS },
};

function clampHitl(n: number) {
  return Math.max(0.4, Math.min(0.95, n));
}

export function getBrain(): BrainSettings {
  return {
    ...brain,
    gates: { ...brain.gates },
    automations: { ...brain.automations },
    disabledRuleIds: [...brain.disabledRuleIds],
    thresholds: { ...brain.thresholds },
  };
}

export function setBrain(patch: Partial<BrainSettings>): BrainSettings {
  const hitl =
    patch.hitl == null ? brain.hitl : clampHitl(Number(patch.hitl));
  brain = {
    addendum: patch.addendum != null ? String(patch.addendum) : brain.addendum,
    hitl: Number.isFinite(hitl) ? hitl : brain.hitl,
    gates: patch.gates
      ? {
          webmail: Boolean(patch.gates.webmail),
          gibberish: Boolean(patch.gates.gibberish),
          blacklist: Boolean(patch.gates.blacklist),
        }
      : { ...brain.gates },
    automations: patch.automations
      ? {
          vip: Boolean(patch.automations.vip),
          hitl: Boolean(patch.automations.hitl),
          spam: Boolean(patch.automations.spam),
          nurture: Boolean(patch.automations.nurture),
        }
      : { ...brain.automations },
    disabledRuleIds: Array.isArray(patch.disabledRuleIds)
      ? patch.disabledRuleIds.map(String)
      : [...brain.disabledRuleIds],
    thresholds: patch.thresholds
      ? { ...brain.thresholds, ...patch.thresholds }
      : { ...brain.thresholds },
  };
  return getBrain();
}

const WEBMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "ymail.com",
  "proton.me",
  "protonmail.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "mail.com",
]);

const BLACKLIST_RE =
  /crypto|nft|backlinks|guest\s*post|seo\s*blast|buy\s*followers|viagra|casino|free\s*money|click\s*here/i;

function looksGibberish(name: string, message: string): boolean {
  const n = name.trim();
  if (n.length < 2) return true;
  if (/^(.)\1{3,}$/i.test(n)) return true;
  if (/^[bcdfghjklmnpqrstvwxyz]{6,}$/i.test(n.replace(/\s/g, ""))) return true;
  const compact = message.replace(/\s+/g, "");
  if (compact.length > 0 && compact.length < 6 && n.length < 4) return true;
  return false;
}

/** Apply hard DQ gates + automation routing after the scoring pipeline. */
export function applyBrainPolicies<
  T extends {
    email: string;
    name: string;
    message: string;
    score: number;
    classification: string;
    tier: string;
    reasoning: string;
    needsReview: boolean;
    pipelineStage?: string;
    routingReason?: string;
  },
>(lead: T, settings: BrainSettings = getBrain()): T {
  const next = { ...lead };
  const domain = (next.email.split("@")[1] ?? "").toLowerCase();
  const notes: string[] = [];

  if (settings.gates.webmail && WEBMAIL.has(domain)) {
    next.classification = "spam";
    next.score = Math.min(next.score, 15);
    next.tier = "cold";
    next.needsReview = false;
    notes.push(`webmail gate (${domain})`);
  }

  if (
    settings.gates.blacklist &&
    (BLACKLIST_RE.test(next.message) || BLACKLIST_RE.test(next.email) || BLACKLIST_RE.test(next.name))
  ) {
    next.classification = "spam";
    next.score = Math.min(next.score, 12);
    next.tier = "cold";
    next.needsReview = false;
    notes.push("blacklist gate");
  }

  if (settings.gates.gibberish && looksGibberish(next.name, next.message)) {
    next.classification = "spam";
    next.score = Math.min(next.score, 10);
    next.tier = "cold";
    next.needsReview = false;
    notes.push("gibberish gate");
  }

  // Soft: disabled scoring rules reduce confidence band (desk-configured weights).
  const disabled = settings.disabledRuleIds.length;
  if (disabled > 0 && next.classification === "lead") {
    const penalty = Math.min(12, disabled * 2);
    next.score = Math.max(0, next.score - penalty);
    if (next.score < 50) next.tier = "cold";
    else if (next.score < 75) next.tier = "warm";
    notes.push(`${disabled} rules disabled (−${penalty})`);
  }

  const auto = settings.automations;
  if (auto.spam && next.classification === "spam") {
    next.pipelineStage = "lost";
    next.routingReason = "Automation: Quarantine spam";
    notes.push("auto quarantine");
  } else if (auto.vip && next.classification === "lead" && next.score >= settings.thresholds.vipScore) {
    next.needsReview = false;
    next.pipelineStage = next.pipelineStage === "new" || !next.pipelineStage ? "qualified" : next.pipelineStage;
    next.routingReason = "Automation: VIP Enterprise Fast-Track";
    notes.push("auto VIP");
  } else if (
    auto.nurture &&
    next.classification === "lead" &&
    next.score >= settings.thresholds.nurtureMin &&
    next.score <= settings.thresholds.nurtureMax &&
    !next.needsReview
  ) {
    next.routingReason = "Automation: Nurture SMB sequence";
    notes.push("auto nurture");
  } else if (auto.hitl && next.needsReview) {
    next.routingReason = next.routingReason || "Automation: HITL escalation armed";
  }

  if (notes.length) {
    next.reasoning = `[Gates] ${notes.join(" · ")}. ${next.reasoning}`;
  }

  // Recompute tier from final score for lead class
  if (next.classification === "lead") {
    next.tier = next.score >= 75 ? "hot" : next.score >= 50 ? "warm" : "cold";
  }

  return next;
}
