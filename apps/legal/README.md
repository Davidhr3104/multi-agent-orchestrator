# Helix for Legal

RFP / document intelligence vertical. Reuses **ORCH, EXT, FACT, REV** from `@helix/core`. Theme is navy + gold to match the **HELIX FOR LEGAL** lockup (helix + scales).

## Run

From the repo root:

```bash
npm install
npm run dev:legal
```

Open [http://127.0.0.1:43149](http://127.0.0.1:43149).

Paste RFP text or drop a PDF. Edit the client profile used for match scoring. Demo seeds four opportunities. Heuristic scoring if `ANTHROPIC_API_KEY` is missing. “Ask corpus” is mocked (no pgvector this sprint).

FACT cites character spans from the document (`quote` + `spanStart`/`spanEnd`).

## Env

Copy `apps/legal/.env.example` to `.env.local`. Optional Claude + Supabase (`legal` schema in `supabase/schemas/legal.sql`).
