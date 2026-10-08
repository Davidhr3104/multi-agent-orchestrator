export const MAX_ROWS = 5000;
export const DEFAULT_ORG_ID = "org-helix";
export const DEMO_DATASET_ID = "seed-dirty-leads";

export type CellOrigin = "rule" | "ai";
export type DecisionStatus = "pending" | "approved" | "rejected" | "auto_approved";
export type IssueSeverity = "info" | "warn" | "block";
export type ImportFieldType = "text" | "email" | "phone" | "money" | "date" | "number";
export type DatasetSource = "file";
export type VersionKind = "original" | "cleaned";
export type DeskMode = "demo" | "live";

export type ImportField = {
  name: string;
  type: ImportFieldType;
  required: boolean;
};

export type ImportContract = {
  app: "leads" | "marketing" | "commerce" | "real-estate" | "legal" | "inbox" | "social";
  name: string;
  version: number;
  fields: ImportField[];
  maxRows: number;
};

export type ColumnMapping = {
  column: string;
  field: string | null;
  confidence: number;
  evidence: string;
};

export type DatasetRecord = {
  id: string;
  orgId: string;
  name: string;
  source: DatasetSource;
  originalFileName: string;
  invented: boolean;
  /** Session cookie. Seed rows are visible to everyone; uploads only to this visitor. */
  ownerKey: string | null;
  createdAt: string;
};

export type DatasetVersion = {
  id: string;
  datasetId: string;
  kind: VersionKind;
  storageKey: string;
  rows: number;
  cols: number;
  hash: string;
  createdAt: string;
};

export type ColumnProfile = {
  versionId: string;
  column: string;
  columnIndex: number;
  inferredType: ImportFieldType | "mixed" | "empty";
  completeness: number;
  mixedFormats: boolean;
  empty: boolean;
  uniqueCount: number;
  sample: string[];
  issueCount: number;
};

export type Issue = {
  id: string;
  versionId: string;
  column: string;
  rowIndex: number;
  ruleId: string;
  severity: IssueSeverity;
  message: string;
};

export type ProposedChange = {
  id: string;
  issueId: string | null;
  cellRef: string;
  rowIndex: number;
  column: string;
  before: string;
  after: string;
  ruleId: string;
  origin: CellOrigin;
  confidence: number;
  evidence: string;
  autoApprove: boolean;
};

export type Decision = {
  changeId: string;
  decidedBy: string;
  decidedAt: string;
  status: DecisionStatus;
};

export type CellProvenance = {
  cellRef: string;
  originalValue: string;
  currentValue: string;
  ruleId: string | null;
  origin: CellOrigin | null;
  confidence: number | null;
  approvedBy: string | null;
  approvedAt: string | null;
};

export type SheetGrid = {
  headers: string[];
  rows: string[][];
};

export type DatasetBundle = {
  dataset: DatasetRecord;
  original: DatasetVersion;
  cleaned: DatasetVersion | null;
  grid: SheetGrid;
  originalGrid: SheetGrid;
  profiles: ColumnProfile[];
  issues: Issue[];
  changes: ProposedChange[];
  decisions: Decision[];
  mapping: ColumnMapping[];
  targetApp: ImportContract["app"];
  truncated: boolean;
  hitlCount: number;
  autoCount: number;
};

export type DeskKpis = {
  datasets: number;
  rows: number;
  hitlPending: number;
  autoApproved: number;
  invented: number;
};
