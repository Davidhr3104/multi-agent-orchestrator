import Link from "next/link";
import { PageFrame } from "@/components/desk-kit";

const STEPS = [
  {
    title: "1. Upload a copy",
    body: "Drop an .xlsx or .csv (5,000 rows max). Helix stores an immutable original. Cleaning always writes a new file. There is no Google Sheets connector yet.",
  },
  {
    title: "2. Profile the columns",
    body: "Types, completeness, mixed formats, and duplicates are counted. Empty cells stay empty. Helix never invents a value.",
  },
  {
    title: "3. Map headers",
    body: "Pick a destination contract (Leads, Marketing spend, Commerce, Real Estate). Mapping is heuristic from the header names. Confirm it before you trust a dry-run.",
  },
  {
    title: "4. Approve HITL cells",
    body: "Ambiguous dates (03/04), broken emails, and anything a rule will not guess wait in amber. Safe trims, case, ISO dates, E.164-ish phones, and money format apply automatically.",
  },
  {
    title: "5. Ask Helix AI",
    body: "Ask about a cell (E3), the HITL queue, completeness, or duplicates. Answers cite cells on this desk. Limited Mode does not call a model — check the grid.",
  },
  {
    title: "6. Dry-run, then export",
    body: "Dry-run checks the contract and stops. Nothing is sent to another Helix. Export downloads a new workbook: money as numbers, Unverified and Audit sheets for pending cells.",
  },
  {
    title: "7. Demo and privacy",
    body: "Dirty inbound leads.csv is invented demo data. Your uploads are scoped to this browser session. They are not a shared CRM, and they vanish on a cold start until a database is connected.",
  },
];

export default function HelpPage() {
  return (
    <PageFrame title="How to use" subtitle="Profile, verify, and export a new sheet. A person still decides the ambiguous cells.">
      <ol className="max-w-3xl space-y-3">
        {STEPS.map((s) => (
          <li key={s.title} className="paper-plate rounded-xl p-5">
            <h2 className="text-sm font-semibold">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm">
        <Link className="text-accent underline" href="/">
          Back to the desk
        </Link>
      </p>
    </PageFrame>
  );
}
