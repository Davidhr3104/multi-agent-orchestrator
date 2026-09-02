# Helix for Legal — Design

**Date:** 2026-09-02  
**Status:** Approved (chat) + visual: each vertical page matches its lockup

## Decisions

- Next template after Leads: **HELIX FOR LEGAL** (RFP / document intelligence).
- Layout: `apps/legal` + `packages/helix-core` RFP pipeline. Port **43149**.
- Ingest: paste JSON/text (same cut as Leads). No Gmail / SFTP / scraping.
- No pgvector RAG this sprint; “Ask corpus” is mocked.
- Theme: navy helix + gold scales (lockup `helix-for-legal.png`). Helix for Leads stays cyan/blue funnel.

## Pipeline

1. `POST /api/rfps/ingest`: `title`, `body`, optional `issuer`, `client_profile`.
2. EXT: deadline, amount, method (BEAR / SPI / other), requirements — `ScoredField[]`.
3. FACT: mark unverified if the value is not evidenced in `body`.
4. REC: match 0–100 vs injury-law / clinical-analysis profile; tier hot/warm/cold.
5. REV: HITL if confidence &lt; 0.65 or match in 40–60.
6. Claude when keyed; else heuristic.

## Out of scope

Gmail, SFTP, pgvector, Loom, Fran case study write-up.
