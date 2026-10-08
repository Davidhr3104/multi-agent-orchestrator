import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createDemoGate, getSecret, onSecretsChanged } from "@helix/core";
import type {
  ColumnMapping,
  ColumnProfile,
  DatasetBundle,
  DatasetRecord,
  DatasetVersion,
  Decision,
  Issue,
  ProposedChange,
  SheetGrid,
} from "@/lib/types";

type Client = SupabaseClient;
let cached: Client | null | undefined;
onSecretsChanged(() => {
  cached = undefined;
});

export function isSupabaseConfigured(): boolean {
  return Boolean(
    getSecret("NEXT_PUBLIC_SUPABASE_URL") &&
      (getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY"))
  );
}

export const dataGate = createDemoGate("data");

function dataDb(): Client | null {
  return dataGate.suspended() ? null : getSupabase();
}

export function getSupabase(): Client | null {
  if (cached !== undefined) return cached;
  const url = getSecret("NEXT_PUBLIC_SUPABASE_URL");
  const key = getSecret("SUPABASE_SERVICE_ROLE_KEY") || getSecret("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) {
    cached = null;
    return null;
  }
  cached = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return cached;
}

type Query = {
  select: (cols: string) => {
    eq: (col: string, value: string) => {
      maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
      order: (
        col: string,
        opts: { ascending: boolean }
      ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
    order: (
      col: string,
      opts: { ascending: boolean }
    ) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
  };
  upsert: (
    row: Record<string, unknown> | Record<string, unknown>[],
    opts?: { onConflict?: string }
  ) => Promise<{ error: { message: string } | null }>;
  delete: () => {
    eq: (col: string, value: string) => Promise<{ error: { message: string } | null }>;
  };
};

function table(
  db: Client,
  name:
    | "datasets"
    | "dataset_versions"
    | "column_profiles"
    | "issues"
    | "proposed_changes"
    | "decisions"
    | "publications"
): Query {
  return (db as unknown as { schema: (s: string) => { from: (t: string) => Query } }).schema("data").from(name);
}

export async function supabaseProbeLiveCount(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;
  const { data, error } = await table(db, "datasets").select("id,invented").order("created_at", { ascending: false });
  if (error || !data) return 0;
  return data.filter((r) => r.invented !== true).length;
}

function asGrid(v: unknown): SheetGrid {
  const g = v as SheetGrid | undefined;
  if (!g || !Array.isArray(g.headers) || !Array.isArray(g.rows)) return { headers: [], rows: [] };
  return { headers: g.headers.map(String), rows: g.rows.map((r) => r.map((c) => String(c ?? ""))) };
}

export async function supabaseListBundles(): Promise<DatasetBundle[] | null> {
  const db = dataDb();
  if (!db) return null;
  const { data: sets, error } = await table(db, "datasets").select("*").order("created_at", { ascending: false });
  if (error) return null;
  const out: DatasetBundle[] = [];
  for (const row of sets ?? []) {
    const bundle = await loadBundle(db, String(row.id));
    if (bundle) out.push(bundle);
  }
  return out;
}

async function loadBundle(db: Client, datasetId: string): Promise<DatasetBundle | null> {
  const { data: ds } = await table(db, "datasets").select("*").eq("id", datasetId).maybeSingle();
  if (!ds) return null;
  const { data: versions } = await table(db, "dataset_versions").select("*").eq("dataset_id", datasetId).order("created_at", {
    ascending: true,
  });
  const originalRow = (versions ?? []).find((v) => v.kind === "original");
  const cleanedRow = [...(versions ?? [])].reverse().find((v) => v.kind === "cleaned");
  if (!originalRow) return null;
  const versionId = String(originalRow.id);
  const payload = originalRow.payload as { grid?: SheetGrid; mapping?: ColumnMapping[]; targetApp?: DatasetBundle["targetApp"]; truncated?: boolean };
  const originalGrid = asGrid(payload?.grid);
  const { data: profileRows } = await table(db, "column_profiles").select("*").eq("version_id", versionId).order("column_index", {
    ascending: true,
  });
  const { data: issueRows } = await table(db, "issues").select("*").eq("version_id", versionId).order("row_index", { ascending: true });
  const { data: changeRows } = await table(db, "proposed_changes").select("*").eq("version_id", versionId).order("row_index", {
    ascending: true,
  });
  const changes: ProposedChange[] = (changeRows ?? []).map(fromChange);
  const { data: decisionRows } = await table(db, "decisions").select("*").eq("change_id", changes[0]?.id ?? "").maybeSingle();
  void decisionRows;
  const decisions: Decision[] = [];
  for (const c of changes) {
    const { data: d } = await table(db, "decisions").select("*").eq("change_id", c.id).maybeSingle();
    if (d) {
      decisions.push({
        changeId: String(d.change_id),
        decidedBy: String(d.decided_by ?? ""),
        decidedAt: String(d.decided_at ?? ""),
        status: d.status as Decision["status"],
      });
    }
  }
  const dataset: DatasetRecord = {
    id: String(ds.id),
    orgId: String(ds.org_id),
    name: String(ds.name),
    source: "file",
    originalFileName: String(ds.original_file_name),
    invented: Boolean(ds.invented),
    ownerKey: typeof ds.owner_key === "string" ? ds.owner_key : null,
    createdAt: String(ds.created_at),
  };
  const original = fromVersion(originalRow);
  const cleaned = cleanedRow ? fromVersion(cleanedRow) : null;
  const grid = cleaned ? asGrid((cleanedRow!.payload as { grid?: SheetGrid }).grid) : originalGrid;
  const autoCount = decisions.filter((d) => d.status === "auto_approved").length;
  const hitlCount = decisions.filter((d) => d.status === "pending").length;
  return {
    dataset,
    original,
    cleaned,
    grid,
    originalGrid,
    profiles: (profileRows ?? []).map(fromProfile),
    issues: (issueRows ?? []).map(fromIssue),
    changes,
    decisions,
    mapping: payload?.mapping ?? [],
    targetApp: payload?.targetApp ?? "leads",
    truncated: Boolean(payload?.truncated),
    hitlCount,
    autoCount,
  };
}

function fromVersion(row: Record<string, unknown>): DatasetVersion {
  return {
    id: String(row.id),
    datasetId: String(row.dataset_id),
    kind: row.kind === "cleaned" ? "cleaned" : "original",
    storageKey: String(row.storage_key),
    rows: Number(row.rows),
    cols: Number(row.cols ?? 0),
    hash: String(row.hash),
    createdAt: String(row.created_at),
  };
}

function fromProfile(row: Record<string, unknown>): ColumnProfile {
  return {
    versionId: String(row.version_id),
    column: String(row.column_name),
    columnIndex: Number(row.column_index),
    inferredType: row.inferred_type as ColumnProfile["inferredType"],
    completeness: Number(row.completeness),
    mixedFormats: Boolean(row.mixed_formats),
    empty: Boolean(row.empty),
    uniqueCount: Number(row.unique_count),
    sample: Array.isArray(row.sample) ? (row.sample as string[]) : [],
    issueCount: Number(row.issue_count),
  };
}

function fromIssue(row: Record<string, unknown>): Issue {
  return {
    id: String(row.id),
    versionId: String(row.version_id),
    column: String(row.column_name),
    rowIndex: Number(row.row_index),
    ruleId: String(row.rule_id),
    severity: row.severity as Issue["severity"],
    message: String(row.message),
  };
}

function fromChange(row: Record<string, unknown>): ProposedChange {
  return {
    id: String(row.id),
    issueId: row.issue_id ? String(row.issue_id) : null,
    cellRef: String(row.cell_ref),
    rowIndex: Number(row.row_index),
    column: String(row.column_name),
    before: String(row.before_value),
    after: String(row.after_value),
    ruleId: String(row.rule_id),
    origin: row.origin === "ai" ? "ai" : "rule",
    confidence: Number(row.confidence),
    evidence: String(row.evidence),
    autoApprove: Boolean(row.auto_approve),
  };
}

export async function supabaseSaveBundle(bundle: DatasetBundle): Promise<{ error?: string }> {
  const db = dataDb();
  if (!db) return {};
  const dsErr = await table(db, "datasets").upsert({
    id: bundle.dataset.id,
    org_id: bundle.dataset.orgId,
    name: bundle.dataset.name,
    source: bundle.dataset.source,
    original_file_name: bundle.dataset.originalFileName,
    invented: bundle.dataset.invented,
    created_at: bundle.dataset.createdAt,
  });
  if (dsErr.error) return { error: dsErr.error.message };
  const payload = {
    grid: bundle.originalGrid,
    mapping: bundle.mapping,
    targetApp: bundle.targetApp,
    truncated: bundle.truncated,
  };
  const vErr = await table(db, "dataset_versions").upsert({
    id: bundle.original.id,
    dataset_id: bundle.dataset.id,
    kind: bundle.original.kind,
    storage_key: bundle.original.storageKey,
    rows: bundle.original.rows,
    cols: bundle.original.cols,
    hash: bundle.original.hash,
    payload,
    created_at: bundle.original.createdAt,
  });
  if (vErr.error) return { error: vErr.error.message };
  if (bundle.cleaned) {
    await table(db, "dataset_versions").upsert({
      id: bundle.cleaned.id,
      dataset_id: bundle.dataset.id,
      kind: "cleaned",
      storage_key: bundle.cleaned.storageKey,
      rows: bundle.cleaned.rows,
      cols: bundle.cleaned.cols,
      hash: bundle.cleaned.hash,
      payload: { grid: bundle.grid },
      created_at: bundle.cleaned.createdAt,
    });
  }
  for (const p of bundle.profiles) {
    await table(db, "column_profiles").upsert({
      id: `${p.versionId}:${p.columnIndex}`,
      version_id: p.versionId,
      column_name: p.column,
      column_index: p.columnIndex,
      inferred_type: p.inferredType,
      completeness: p.completeness,
      mixed_formats: p.mixedFormats,
      empty: p.empty,
      unique_count: p.uniqueCount,
      sample: p.sample,
      issue_count: p.issueCount,
    });
  }
  for (const i of bundle.issues) {
    await table(db, "issues").upsert({
      id: i.id,
      version_id: i.versionId,
      column_name: i.column,
      row_index: i.rowIndex,
      rule_id: i.ruleId,
      severity: i.severity,
      message: i.message,
    });
  }
  for (const c of bundle.changes) {
    await table(db, "proposed_changes").upsert({
      id: c.id,
      issue_id: c.issueId,
      version_id: bundle.original.id,
      cell_ref: c.cellRef,
      row_index: c.rowIndex,
      column_name: c.column,
      before_value: c.before,
      after_value: c.after,
      rule_id: c.ruleId,
      origin: c.origin,
      confidence: c.confidence,
      evidence: c.evidence,
      auto_approve: c.autoApprove,
    });
  }
  for (const d of bundle.decisions) {
    await table(db, "decisions").upsert({
      change_id: d.changeId,
      decided_by: d.decidedBy,
      decided_at: d.decidedAt || null,
      status: d.status,
    });
  }
  return {};
}

export async function supabaseRecordPublication(row: {
  id: string;
  versionId: string;
  targetApp: string;
  contractVersion: number;
  accepted: number;
  rejected: number;
  dryRun: boolean;
  idempotencyKey: string;
}): Promise<{ error?: string; duplicate?: boolean }> {
  const db = dataDb();
  if (!db) return {};
  const { error } = await table(db, "publications").upsert(
    {
      id: row.id,
      version_id: row.versionId,
      target_app: row.targetApp,
      contract_version: row.contractVersion,
      accepted: row.accepted,
      rejected: row.rejected,
      dry_run: row.dryRun,
      idempotency_key: row.idempotencyKey,
    },
    { onConflict: "idempotency_key" }
  );
  if (error?.message.toLowerCase().includes("duplicate")) return { duplicate: true };
  if (error) return { error: error.message };
  return {};
}
