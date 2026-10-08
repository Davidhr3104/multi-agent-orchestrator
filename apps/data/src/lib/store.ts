import { randomUUID } from "node:crypto";
import { DEMO_ID_PREFIX, autoSeedEnabled, demoAvailable, resolveDeskMode } from "@helix/core";
import type { DatasetBundle, DeskKpis, DeskMode, ImportContract, SheetGrid } from "@/lib/types";
import { DEFAULT_ORG_ID, DEMO_DATASET_ID } from "@/lib/types";
import { sha256 } from "@/lib/hash";
import { runPipeline } from "@/lib/pipeline";
import { applyApproved } from "@/lib/rules";
import { dirtyLeadsGrid, DEMO_META, DIRTY_LEADS_CSV } from "@/lib/demo";
import { cloneGrid } from "@/lib/utils";
import { contractFor, guessTargetApp, mapColumns, publicationIdempotencyKey, validateAgainstContract } from "@/lib/contracts";
import { parseWorkbook } from "@/lib/parse";
import {
  dataGate,
  isSupabaseConfigured,
  supabaseListBundles,
  supabaseProbeLiveCount,
  supabaseRecordPublication,
  supabaseSaveBundle,
} from "@/lib/supabase-desk";

type Memory = {
  bundles: Map<string, DatasetBundle>;
  seeded: boolean;
  remoteBootstrapped: boolean;
};

const g = globalThis as typeof globalThis & { __helixDataDesk?: Memory };

function mem(): Memory {
  g.__helixDataDesk ??= { bundles: new Map(), seeded: false, remoteBootstrapped: false };
  return g.__helixDataDesk;
}

const DEMO_CREATED_AT = "2026-01-15T12:00:00.000Z";

function visibleTo(bundle: DatasetBundle, visitorId: string): boolean {
  if (bundle.dataset.invented) return true;
  return bundle.dataset.ownerKey === visitorId;
}

function seedDemo(): DatasetBundle {
  const grid = dirtyLeadsGrid();
  const now = DEMO_CREATED_AT;
  const versionId = `${DEMO_DATASET_ID}-original`;
  const pipe = runPipeline({ versionId, grid, targetApp: "leads", now });
  const hash = sha256(DIRTY_LEADS_CSV);
  const bundle: DatasetBundle = {
    dataset: {
      id: DEMO_DATASET_ID,
      orgId: DEFAULT_ORG_ID,
      name: DEMO_META.name,
      source: "file",
      originalFileName: DEMO_META.originalFileName,
      invented: true,
      ownerKey: null,
      createdAt: now,
    },
    original: {
      id: versionId,
      datasetId: DEMO_DATASET_ID,
      kind: "original",
      storageKey: `demo:${DEMO_DATASET_ID}`,
      rows: grid.rows.length,
      cols: grid.headers.length,
      hash,
      createdAt: now,
    },
    cleaned: null,
    grid: pipe.preview,
    originalGrid: cloneGrid(grid),
    profiles: pipe.profiles,
    issues: pipe.issues,
    changes: pipe.changes,
    decisions: pipe.decisions,
    mapping: pipe.mapping,
    targetApp: "leads",
    truncated: false,
    hitlCount: pipe.decisions.filter((d) => d.status === "pending").length,
    autoCount: pipe.decisions.filter((d) => d.status === "auto_approved").length,
  };
  return bundle;
}

export async function ensureDesk(): Promise<DeskMode> {
  const remote = isSupabaseConfigured() ? await supabaseProbeLiveCount() : 0;
  dataGate.evaluate({ connected: false, remoteRecords: remote });
  const resolved: DeskMode = dataGate.suspended() ? "demo" : resolveDeskMode({ connected: false, realRecords: remote });
  const m = mem();
  if (resolved === "live" && !m.remoteBootstrapped && isSupabaseConfigured() && !dataGate.suspended()) {
    const remoteBundles = await supabaseListBundles();
    if (remoteBundles) {
      m.bundles.clear();
      for (const b of remoteBundles) m.bundles.set(b.dataset.id, b);
    }
    m.remoteBootstrapped = true;
  }
  if (resolved === "demo" && (!m.seeded || (autoSeedEnabled() && !m.bundles.has(DEMO_DATASET_ID)))) {
    if (demoAvailable()) {
      const demo = seedDemo();
      m.bundles.set(demo.dataset.id, demo);
      m.seeded = true;
    }
  }
  return resolved;
}

export async function deskStatus(): Promise<{
  mode: DeskMode;
  supabase: boolean;
  demoWritesBlocked: boolean;
}> {
  const mode = await ensureDesk();
  return {
    mode,
    supabase: isSupabaseConfigured() && !dataGate.suspended(),
    demoWritesBlocked: dataGate.suspended(),
  };
}

export async function listBundles(visitorId: string): Promise<DatasetBundle[]> {
  await ensureDesk();
  return [...mem().bundles.values()]
    .filter((b) => visibleTo(b, visitorId))
    .sort((a, b) => (a.dataset.createdAt < b.dataset.createdAt ? 1 : -1));
}

export async function getBundle(id: string, visitorId: string): Promise<DatasetBundle | null> {
  await ensureDesk();
  const bundle = mem().bundles.get(id) ?? null;
  if (!bundle || !visibleTo(bundle, visitorId)) return null;
  return bundle;
}

export async function kpis(visitorId: string): Promise<DeskKpis> {
  const rows = await listBundles(visitorId);
  return {
    datasets: rows.length,
    rows: rows.reduce((s, b) => s + b.original.rows, 0),
    hitlPending: rows.reduce((s, b) => s + b.hitlCount, 0),
    autoApproved: rows.reduce((s, b) => s + b.autoCount, 0),
    invented: rows.filter((b) => b.dataset.invented).length,
  };
}

export async function ingestFile(
  filename: string,
  bytes: Uint8Array,
  invented = false,
  visitorId = "anon"
): Promise<DatasetBundle | string> {
  await ensureDesk();
  const parsed = parseWorkbook(bytes, filename);
  if (typeof parsed === "string") return parsed;
  const now = new Date().toISOString();
  const id = invented ? `${DEMO_ID_PREFIX}${randomUUID().slice(0, 8)}` : `ds-${randomUUID()}`;
  const versionId = `${id}-original`;
  const targetApp = guessTargetApp(filename);
  const pipe = runPipeline({ versionId, grid: parsed.grid, targetApp, now });
  const hash = sha256(bytes);
  const bundle: DatasetBundle = {
    dataset: {
      id,
      orgId: DEFAULT_ORG_ID,
      name: filename,
      source: "file",
      originalFileName: filename,
      invented,
      ownerKey: invented ? null : visitorId,
      createdAt: now,
    },
    original: {
      id: versionId,
      datasetId: id,
      kind: "original",
      storageKey: `file:${filename}`,
      rows: parsed.grid.rows.length,
      cols: parsed.grid.headers.length,
      hash,
      createdAt: now,
    },
    cleaned: null,
    grid: pipe.preview,
    originalGrid: cloneGrid(parsed.grid),
    profiles: pipe.profiles,
    issues: pipe.issues,
    changes: pipe.changes,
    decisions: pipe.decisions,
    mapping: pipe.mapping,
    targetApp,
    truncated: parsed.truncated,
    hitlCount: pipe.decisions.filter((d) => d.status === "pending").length,
    autoCount: pipe.decisions.filter((d) => d.status === "auto_approved").length,
  };
  mem().bundles.set(id, bundle);
  if (!dataGate.suspended()) await supabaseSaveBundle(bundle);
  return bundle;
}

export async function decide(
  datasetId: string,
  changeIds: string[],
  status: "approved" | "rejected",
  actor: string,
  visitorId: string
): Promise<DatasetBundle | string> {
  await ensureDesk();
  const bundle = await getBundle(datasetId, visitorId);
  if (!bundle) return "Dataset not found.";
  const now = new Date().toISOString();
  bundle.decisions = bundle.decisions.map((d) =>
    changeIds.includes(d.changeId) ? { ...d, status, decidedBy: actor, decidedAt: now } : d
  );
  bundle.grid = applyApproved(bundle.originalGrid, bundle.changes, bundle.decisions);
  bundle.hitlCount = bundle.decisions.filter((d) => d.status === "pending").length;
  bundle.autoCount = bundle.decisions.filter((d) => d.status === "auto_approved" || d.status === "approved").length;
  if (!dataGate.suspended()) await supabaseSaveBundle(bundle);
  return bundle;
}

export async function setMapping(
  datasetId: string,
  targetApp: ImportContract["app"],
  mapping: { column: string; field: string | null }[] | undefined,
  visitorId: string
): Promise<DatasetBundle | string> {
  await ensureDesk();
  const bundle = await getBundle(datasetId, visitorId);
  if (!bundle) return "Dataset not found.";
  bundle.targetApp = targetApp;
  const contract = contractFor(targetApp);
  if (mapping) {
    bundle.mapping = bundle.mapping.map((m) => {
      const next = mapping.find((x) => x.column === m.column);
      return next ? { ...m, field: next.field, evidence: next.field ? `Mapped to ${next.field}.` : m.evidence } : m;
    });
  } else {
    bundle.mapping = mapColumns(bundle.originalGrid, contract);
  }
  if (!dataGate.suspended()) await supabaseSaveBundle(bundle);
  return bundle;
}

export async function markCleanedExport(datasetId: string, hash: string, grid: SheetGrid, visitorId: string): Promise<void> {
  const bundle = await getBundle(datasetId, visitorId);
  if (!bundle) return;
  const now = new Date().toISOString();
  bundle.cleaned = {
    id: `${datasetId}-cleaned-${now.slice(0, 19)}`,
    datasetId,
    kind: "cleaned",
    storageKey: `export:${bundle.dataset.originalFileName}.cleaned`,
    rows: grid.rows.length,
    cols: grid.headers.length,
    hash,
    createdAt: now,
  };
  if (!dataGate.suspended()) await supabaseSaveBundle(bundle);
}

export async function dryRunPublish(datasetId: string, targetApp: ImportContract["app"], visitorId: string) {
  const bundle = await getBundle(datasetId, visitorId);
  if (!bundle) return "Dataset not found.";
  await setMapping(datasetId, targetApp, undefined, visitorId);
  const fresh = mem().bundles.get(datasetId)!;
  const contract = contractFor(targetApp);
  const rows = validateAgainstContract(fresh.grid, fresh.mapping, contract);
  const accepted = rows.filter((r) => r.accepted).length;
  const rejected = rows.filter((r) => !r.accepted);
  const idempotencyKey = publicationIdempotencyKey(fresh.original.hash, contract.app, contract.version);
  if (!dataGate.suspended()) {
    await supabaseRecordPublication({
      id: `pub-${idempotencyKey}`,
      versionId: fresh.original.id,
      targetApp: contract.app,
      contractVersion: contract.version,
      accepted,
      rejected: rejected.length,
      dryRun: true,
      idempotencyKey,
    });
  }
  return {
    dryRun: true as const,
    message: "Dry-run only. Nothing was sent to another Helix. Rows are scored against the contract you picked; rejected rows stay on this desk with a reason.",
    contract: { app: contract.app, name: contract.name, version: contract.version },
    idempotencyKey,
    accepted,
    rejected: rejected.map((r) => ({ row: r.rowIndex + 2, reasons: r.reasons })),
    originalIntact: true,
    invented: fresh.dataset.invented,
  };
}

export async function loadDemoCatalog() {
  dataGate.reset();
  mem().bundles.clear();
  mem().seeded = false;
  mem().remoteBootstrapped = false;
  dataGate.evaluate({ connected: false, remoteRecords: 0 });
  const demo = seedDemo();
  mem().bundles.set(demo.dataset.id, demo);
  mem().seeded = true;
  return deskStatus();
}

export async function goLiveEmpty() {
  dataGate.goLive();
  mem().bundles.clear();
  mem().seeded = false;
  mem().remoteBootstrapped = false;
  return deskStatus();
}

export function originalUntouched(bundle: DatasetBundle): boolean {
  return JSON.stringify(bundle.originalGrid) !== undefined && bundle.original.kind === "original";
}
