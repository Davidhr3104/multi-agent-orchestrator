# Helix — family briefing (read this first)

Helix is **not one app**. It is a **premium enterprise product family**: one multi-agent engine, many industry desks. Naming is always `HELIX FOR [VERTICAL]`.

Operator: **Deveku** (Operations). Prefer working in code. Spanish with the user; English in code and this file.

## Final purpose

Ship a **catalog of vertical SaaS desks** that take messy operational work (leads, RFPs, inbox, commerce, later video/social) and turn it into **scored, cited, human-reviewed decisions**. Same agents, same HITL pattern, different domain UI.

We do **not** build one mega-dashboard. Each vertical is its own Next.js app. Shared brain: `packages/helix-core`. Ops can switch products with `HELIX_OPERATOR_KEY` (`/operator`, cookie per origin). Do **not** export `@helix/core/operator` from the main barrel (uses Node `crypto`).

## How every Helix works

Pipeline (names in logs / UI):

| Agent | Id | Job |
| --- | --- | --- |
| Orchestrator | `orchestrator` | Classify input, run the graph, consolidate |
| Extractor | `extractor` | Structured fields + confidence + evidence |
| Fact-checker | `factchecker` | Cite spans; mark `unverified` instead of inventing |
| Recommender | `recommender` | Score / classify / next action |
| Reviewer | `reviewer` | HITL: approve / revise / block |

Rules that always apply:

- Claude (`ANTHROPIC_API_KEY`) is optional. Missing or failed API → **heuristic fallback**, never a blank screen.
- Money: `$85,000` (never `$85k`). Dates: ISO `2026-09-18`.
- Persist later with Supabase; MVP may be in-memory with the same seed as SQL.
- Do not break an existing vertical’s look unless the user asks. Leads = cyan/navy. Legal = navy + gold (`#0A1628` / `#D4AF37`). Keep official lockup/logo files.

Local:

```bash
npm run dev:core    # Orchestrator  http://127.0.0.1:43147
npm run dev:leads   # Helix for Leads  http://127.0.0.1:43148  (prod: https://helix-for-leads.vercel.app)
npm run dev:legal   # Helix for Legal  http://127.0.0.1:43149
npm run dev:inbox   # Helix for Inbox  http://127.0.0.1:43151
npm run dev:commerce # Helix for Commerce http://127.0.0.1:43150
```

## What we are building (and why)

### Active (build and ship)

| Product | App | Function | Purpose |
| --- | --- | --- | --- |
| **Helix Orchestrator** | `multi-agent-orchestrator/` | Content analysis demo (URL / article / copy) | Original portfolio system: prove the agent graph, permissions matrix, audit logs |
| **Helix for Leads** | `apps/lead-scoring/` | Inbound lead intelligence | Classify lead/spam/info, score 0–100, HITL, enrich, outreach, GHL CRM. **Do not redesign this UI** except requested copy/ops. Lead `id` stays **TEXT**. |
| **Helix for Legal** | `apps/legal/` | RFP intelligence for law firms | Extract RFP fields with FACT cites, match to firm profile, Go/No-Go, COI, smart pricing, deadlines, documents, proposals. Keep PNG logo + **HELIX FOR LEGAL** HTML lockup |
| **Helix for Commerce** | `apps/commerce/` | E-commerce / Shopify ops | Fraud scoring, inventory restock, HITL fulfill. Emerald desk. Local `:43150`. Walkthrough at `/help`. |
| **Helix for Inbox** | `apps/inbox/` | Inbox triage / EA | Rank, draft, route email so ops is not the bottleneck. Mark: royal-blue helix + envelope. Lockup **HELIX FOR INBOX**. Local `:43151` |

### Planned next (we will arm these)

| Product | Function | Purpose |
| --- | --- | --- |
| **Helix for Marketing** | Campaigns | Campaign intelligence |

### Backlog (family lockups exist; do not start unless asked)

**Helix for Social**, **Helix for Edit**, **Helix for Video**.

Operator switcher already lists Commerce / Video / Social / Edit as disabled (`href: "#"`).

Brand source of truth: `assets/logos/family.json`.

## What not to confuse

- **HyperFrames** = picture / animation. **Remotion** = VO, captions, BGM, editorial. Not Remotion springs as the source of truth for the picture.
- Leads video project: `videos/helix-for-leads/`. Remotion: `helix-video/`, composition **HelixForLeads**.
- Legal features (COI, pricing, documents, deadlines) live only in `apps/legal`. Do not copy them into Leads.

## When implementing

1. Identify the vertical. Stay in that app + `packages/helix-core` if the pipeline is shared.
2. Keep the premium desk. No generic SaaS restyle.
3. HITL + audit + graceful Claude fallback.
4. Ask before committing, pushing, or deploying unless the user already asked.
