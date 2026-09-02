# Helix Lead Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local MVP of Helix for Lead Scoring: ingest JSON, classify/score (Claude or heuristic), persist, dashboard with review + mock CRM.

**Architecture:** npm workspaces. `packages/helix-core` owns types, Claude JSON complete, lead pipeline. `apps/lead-scoring` is a Next.js 16 app with SSE ingest and a filterable dashboard. Store is in-memory with optional Supabase schema `lead_scoring`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, shadcn/base-nova, Supabase JS, Claude Messages API, Vercel.

## Global Constraints

- No CRM HTTP in this sprint; mock send only.
- Demo must run without API keys.
- Do not commit `.env` files.
- Keep existing `multi-agent-orchestrator` demo working.

---

## Tasks

- [x] Workspace + `@helix/core` pipeline + `apps/lead-scoring` dashboard/API + SQL schema + READMEs
- [x] Verify: production build + browser ingest → table → review sheet (CRM mock verified via local API)
