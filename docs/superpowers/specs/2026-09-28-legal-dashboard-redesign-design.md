# Helix for Legal — dashboard visual redesign (Phase 1)

## Purpose

The user supplied a Material 3-style mockup (glassmorphism cards, Material
Symbols icons, a silver/slate gradient palette) as the target look for
Helix for Legal. The mockup is a static HTML reference with no real data
binding — inputs are `readonly`, buttons have no handlers, nav links are
`href="#"`. This spec covers migrating the **visual layer only** of
`apps/legal/src/components/legal-dashboard.tsx` to match that look, while
preserving every existing behavior (fetches, state, drag & drop, form
submission) unchanged.

`apps/legal/src/components/legal-chrome.tsx` (the real sidebar/header with
working navigation across `/`, `/analytics`, `/deadlines`, `/pricing`,
`/outcomes`, etc.) is explicitly **out of scope** for this phase — the
mockup's sidebar/header use fake `href="#"` links and would break real
navigation if copied verbatim. Chrome redesign is a separate future phase.

## Scope

**In scope — sections already present in `legal-dashboard.tsx`, restyled only:**
- Top KPI bar (`id="legal-dashboard"`, ~line 492): Hot Share, Avg Match, Due in 14D, Review Queue
- Ask AI hero (`AskAiCard` component, already inserted) — restyled to the mockup's glassmorphism/silver-gradient hero
- Opportunities table (`id="legal-opportunities"`, ~line 616)
- Win/Loss (modeled) analytics (`id="legal-analytics"`, ~line 893)
- Ingest RFP dropzone + form (`id="legal-documents"`, ~line 939)
- Client profile (`id="legal-settings"`, ~line 1063)

**New in this phase (no prior equivalent):**
- "Live Pipeline Status" card — small status card at the bottom of the right
  column. Wired to real state: shows "Waiting for next batch..." style copy
  when `running` is false, and reflects the latest entry of `logs` when
  `running` is true. Not a cosmetic-only add — see Task list below for the
  exact binding.

**Out of scope:**
- `legal-chrome.tsx` (sidebar/header) — untouched this phase.
- Any other page/route in `apps/legal` beyond the dashboard.
- Any change to API routes, `@/lib/store`, or data shapes.
- Deadlines/audit sections deeper in the file (`id="legal-deadlines"`,
  `id="legal-audit"`, `id="legal-conflicts"`, etc., past what the mockup
  shows) — only the sections the mockup covers are restyled; sections
  beyond it keep their current Legal dark-terminal style for now.

## Fonts and design tokens

### Material Symbols Outlined

Add alongside the existing `Inter`/`IBM_Plex_Mono` in
`apps/legal/src/app/layout.tsx`, using the same `next/font/google` pattern
already used there. Next.js's `next/font/google` package does not ship
Material Symbols as a font family object the same way it does
Inter/IBM_Plex_Mono (it's a variable icon font, not a text font) — so it is
loaded via a `<link>` tag in the document head instead, matching exactly
how the mockup's own `<head>` loads it:

```
https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200
```

Icons then render as `<span className="material-symbols-outlined">icon_name</span>`,
replacing the `lucide-react` icons currently used in the migrated sections
only (icons in untouched sections of the file keep `lucide-react`).

### Material 3 color tokens

Add as CSS custom properties in `apps/legal/src/app/globals.css`, scoped
so they don't leak into or conflict with Legal's existing hardcoded-hex
dark theme used elsewhere in the file (untouched sections keep using
`#111827`/`#1F2937`/`#F59E0B` etc. directly, unaffected by these new
tokens). Values are taken directly from the `tailwind.config` block
embedded in the user's supplied HTML (the `colors` object under
`theme.extend`), reproduced as `--legal-md3-*` prefixed variables to avoid
any collision with tokens other Helix apps define globally (e.g.
`--border-hairline` in Marketing). Example (non-exhaustive — implementer
copies every key from the supplied `colors` object with this naming):

```css
--legal-md3-surface-container-lowest: #0c0e12;
--legal-md3-surface-container-low: #1a1c20;
--legal-md3-surface-container: #1e2024;
--legal-md3-surface-container-high: #282a2e;
--legal-md3-surface-container-highest: #333539;
--legal-md3-on-surface: #e2e2e8;
--legal-md3-on-surface-variant: #c4c7c9;
--legal-md3-outline: #8e9193;
--legal-md3-outline-variant: #444749;
--legal-md3-primary: #ffffff;
--legal-md3-on-primary: #2d3133;
--legal-md3-primary-container: #e0e3e5;
--legal-md3-on-primary-container: #626567;
--legal-md3-secondary: #b9c8de;
--legal-md3-error: #ffb4ab;
--legal-md3-error-container: #93000a;
--legal-md3-on-error-container: #ffdad6;
```

Migrated sections use these via arbitrary-value Tailwind classes (e.g.
`bg-[var(--legal-md3-surface-container-low)]`) or inline `style` where the
mockup itself used inline `style` (gradients, blur, box-shadow — Tailwind
arbitrary values get unwieldy for multi-stop gradients, so those stay as
inline `style` objects exactly as the mockup wrote them, translated to
React's camelCase `style` prop).

## Section-by-section mapping

Every row below: mockup section → existing code location → what changes.

| Mockup section | Current location | Change type |
|---|---|---|
| Top KPI bar (Hot Share, Avg Match, Due in 14D, Review Queue) | `legal-dashboard.tsx` ~line 492, reads `metrics` | Style only — same `metrics.hotShare`, `metrics.avgMatch`, etc. fields, new markup/classes |
| Ask Helix AI hero | `apps/legal/src/components/ask-ai-card.tsx` (already wired to `POST /api/ask-ai`) | Style only — same `ask`/`onSubmit`/`history` logic, new markup matching the mockup's hero section (badge, gradient title, glass input bar, suggestion chips, right-side image panel) |
| Opportunities table | `legal-dashboard.tsx` ~line 616, reads `visible` (filtered `rfps`) | Style only — same columns' data (title, method, value, match score, status), new table markup/classes, same row click → `setSelected`/`setSheetOpen` |
| Win/Loss (modeled) | `legal-dashboard.tsx` ~line 893, reads `winLoss` (from `useMemo`) | Style only |
| Ingest RFP | `legal-dashboard.tsx` ~line 939 | Style only — same drag & drop handlers (`dragOver`, `pdfPreview`, `pdfProgress`), same form state (`form.title`/`form.issuer`/`form.body`), same "Extract & match" submit calling the existing ingest function |
| Client profile | `legal-dashboard.tsx` ~line 1063 | Style only — same `structured` state, same "Save changes" calling the existing save-profile function |
| Live Pipeline Status | New | See binding below |

### Live Pipeline Status binding

```
running === false  → icon: hourglass_empty, text: "Waiting for next batch…",
                      subtext: "Pipeline idle · Ingest ready", dot: secondary color, static
running === true   → icon: autorenew (or similar), text: the last entry of
                      `logs` (logs[logs.length - 1] ?? "Processing…"),
                      subtext: "Pipeline running", dot: pulsing
```

`running` and `logs` are pre-existing state in `legal-dashboard.tsx`
(confirmed at lines 137–138); this card is a new, small, read-only view
onto them, not new state.

## Testing / verification

No new business logic is introduced (Live Pipeline Status only reads
existing state), so no new unit tests are required. Verification is
visual + typecheck:

- `npm run build --workspace=helix-legal` passes with no TypeScript errors
  after each section is migrated (not just at the end — see plan).
- Local dev server (`npm run dev:legal`) checked in-browser after each
  section: the migrated section renders with the new look, and every
  existing interaction still works — ingest a test RFP, open the sheet by
  clicking an opportunity row, save a client profile change, run a corpus
  check — confirming no regression from the restyle.
