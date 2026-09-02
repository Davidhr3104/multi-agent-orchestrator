# Helix for Lead Scoring — Design

**Date:** 2026-09-01  
**Status:** Approved to implement (architecture + product decisions locked in chat)

## Decisions

- **Layout:** npm workspaces monorepo. Existing app stays `multi-agent-orchestrator/` (core content demo). New vertical: `apps/lead-scoring`. Shared library: `packages/helix-core`. Relocate core to `apps/helix-orchestrator` later if needed.
- **Database:** One Supabase project. Schema `lead_scoring` for this template. Schema `public` remains Helix Orchestrator logs. Demo runs **without** Supabase (in-memory store).
- **CRM:** MVP has **no** GHL/HubSpot HTTP. Ingest JSON → classify/score → persist. UI “Send to CRM” sets `crm_status: mocked`.
- **Deploy:** Vercel (separate project for `apps/lead-scoring`). Local port `43148`.

## Pipeline

1. `POST /api/leads/ingest` JSON: `name`, `email`, `source`, `message`, optional `budget`/`timeline`.
2. EXT: structured `ScoredField[]` with confidence.
3. REC: `classification` (`lead` | `spam` | `info`), `score` 0–100, `tier` (`hot` | `warm` | `cold`), reasoning.
4. REV: `needs_review` if confidence &lt; 0.65 or score in 40–60.
5. Persist + SSE (`log` / `agent` / `result`).
6. Claude when `ANTHROPIC_API_KEY` is set; otherwise deterministic heuristics (demo still works).

## Out of scope (this sprint)

GHL/HubSpot APIs, public GitHub of other portfolio repos, Loom, portfolio `/solutions` page, case study.
