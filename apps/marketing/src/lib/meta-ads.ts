import { getSecret, type CampaignAction, type SpendRowInput } from "@helix/core";

const GRAPH = "https://graph.facebook.com/v21.0";

export function isMetaAdsReadConfigured(): boolean {
  return Boolean(getSecret("META_ACCESS_TOKEN") && getSecret("META_AD_ACCOUNT_ID"));
}

/** Same credentials; token must include ads_management for writes. */
export function isMetaAdsWriteConfigured(): boolean {
  return isMetaAdsReadConfigured();
}

function normalizeAccountId(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("act_")) return trimmed;
  return `act_${trimmed.replace(/^act_/i, "")}`;
}

export function isLiveMetaCampaignId(campaignId: string): boolean {
  const id = campaignId.trim();
  if (!id) return false;
  if (/^ad-[a-z]/i.test(id)) return false;
  if (!/^\d+$/.test(id)) return false;
  return true;
}

type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: { action_type: string; value: string }[];
  date_start?: string;
};

function formLeadsFromActions(actions: InsightRow["actions"]): number | undefined {
  if (!actions?.length) return undefined;
  const leadish = actions.filter((a) =>
    /lead|onsite_conversion\.lead|offsite_conversion\.fb_pixel_lead/i.test(a.action_type)
  );
  if (!leadish.length) return undefined;
  return leadish.reduce((s, a) => s + Number(a.value || 0), 0);
}

async function metaPost(path: string, fields: Record<string, string>): Promise<unknown> {
  const token = getSecret("META_ACCESS_TOKEN");
  if (!token) throw new Error("META_ACCESS_TOKEN missing");
  const body = new URLSearchParams({ ...fields, access_token: token });
  const res = await fetch(`${GRAPH}/${path}`, { method: "POST", body });
  const json = (await res.json()) as { error?: { message?: string }; success?: boolean };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta write HTTP ${res.status}`);
  }
  return json;
}

async function metaGet(path: string, fields: string): Promise<Record<string, unknown>> {
  const token = getSecret("META_ACCESS_TOKEN");
  if (!token) throw new Error("META_ACCESS_TOKEN missing");
  const params = new URLSearchParams({ access_token: token, fields });
  const res = await fetch(`${GRAPH}/${path}?${params.toString()}`);
  const json = (await res.json()) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Meta read HTTP ${res.status}`);
  }
  return json;
}

export type MetaWriteResult = {
  attempted: boolean;
  ok: boolean;
  platform: "meta";
  action: CampaignAction;
  campaignId: string;
  detail: string;
};

/**
 * HITL write-back to Meta Ads Manager.
 * pause → PAUSED · scale → ACTIVE + +20% daily_budget when readable · keep → local only
 */
export async function applyMetaCampaignAction(
  campaignId: string,
  action: CampaignAction
): Promise<MetaWriteResult> {
  const base = {
    attempted: true,
    platform: "meta" as const,
    action,
    campaignId,
  };

  if (!isMetaAdsWriteConfigured()) {
    return {
      ...base,
      attempted: false,
      ok: false,
      detail:
        "Meta writes need META_ACCESS_TOKEN + META_AD_ACCOUNT_ID (token with ads_management). Decision saved locally only.",
    };
  }

  if (!isLiveMetaCampaignId(campaignId)) {
    return {
      ...base,
      attempted: false,
      ok: false,
      detail: "Demo/CSV campaign_id — skipped Ads Manager write. Local decision saved.",
    };
  }

  if (action === "keep") {
    return {
      ...base,
      attempted: false,
      ok: true,
      detail: "Keep stays local — Ads Manager status unchanged.",
    };
  }

  try {
    if (action === "pause") {
      await metaPost(campaignId, { status: "PAUSED" });
      return {
        ...base,
        ok: true,
        detail: "Meta campaign set to PAUSED in Ads Manager.",
      };
    }

    await metaPost(campaignId, { status: "ACTIVE" });
    let budgetNote = "Budget left unchanged (no daily_budget on campaign).";
    try {
      const camp = await metaGet(campaignId, "daily_budget,lifetime_budget");
      const daily = camp.daily_budget != null ? Number(camp.daily_budget) : NaN;
      if (Number.isFinite(daily) && daily > 0) {
        const next = Math.round(daily * 1.2);
        await metaPost(campaignId, { daily_budget: String(next) });
        budgetNote = `daily_budget ${daily} → ${next} (+20%).`;
      }
    } catch {
      budgetNote = "ACTIVE set; budget bump skipped (no daily_budget or permission).";
    }
    return {
      ...base,
      ok: true,
      detail: `Meta campaign ACTIVE. ${budgetNote}`,
    };
  } catch (err) {
    return {
      ...base,
      ok: false,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Pull campaign-level Insights. */
export async function fetchMetaCampaignSpend(opts: {
  since: string;
  until: string;
}): Promise<{ rows: SpendRowInput[]; accountId: string }> {
  const token = getSecret("META_ACCESS_TOKEN");
  const accountId = normalizeAccountId(getSecret("META_AD_ACCOUNT_ID"));
  if (!token || !getSecret("META_AD_ACCOUNT_ID")) {
    throw new Error("Meta Ads read needs META_ACCESS_TOKEN and META_AD_ACCOUNT_ID in Settings.");
  }

  const params = new URLSearchParams({
    access_token: token,
    level: "campaign",
    fields: "campaign_id,campaign_name,spend,impressions,clicks,actions",
    time_range: JSON.stringify({ since: opts.since, until: opts.until }),
    time_increment: "1",
    limit: "500",
  });

  const url = `${GRAPH}/${accountId}/insights?${params.toString()}`;
  const res = await fetch(url);
  const body = (await res.json()) as {
    data?: InsightRow[];
    error?: { message?: string };
    paging?: { next?: string };
  };

  if (!res.ok) {
    throw new Error(body.error?.message || `Meta Insights HTTP ${res.status}`);
  }

  const rows: SpendRowInput[] = [];
  for (const row of body.data ?? []) {
    const campaignId = row.campaign_id?.trim();
    if (!campaignId) continue;
    const spend = Number(row.spend ?? 0);
    if (!Number.isFinite(spend) || spend < 0) continue;
    rows.push({
      campaignId,
      name: row.campaign_name?.trim() || campaignId,
      platform: "meta",
      spend,
      impressions: row.impressions ? Number(row.impressions) : undefined,
      clicks: row.clicks ? Number(row.clicks) : undefined,
      formLeads: formLeadsFromActions(row.actions),
      occurredAt: row.date_start,
    });
  }

  return { rows, accountId };
}
