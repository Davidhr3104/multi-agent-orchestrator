# Hyperframes Composition Brief: Helix for Commerce

## Objective
Create a short launch-style brag video for Helix for Commerce.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: C:\Users\devex\projects\helix-lead-scoring-template\apps\commerce
- Primary files read: package.json, src/app/globals.css, src/app routes (orders, inventory, help), live captured UI screenshots of the Commerce Operations dashboard and HITL fraud-review flow
- Product name: Helix for Commerce
- Tagline / strongest claim: "Protect your revenue. Automate your operations."
- Key UI or visual moment to recreate: the AI Reasoning panel's stacked risk-signal cards for Order #1003 (red left-border, mono "RISK SIGNAL" eyebrow), and the HITL decision card with its two-button choice
- Copy that must appear verbatim:
  - "FRAUD SCORE"
  - "93/100"
  - "Live Orders Stream"
  - "AI Reasoning · Order #1003"
  - "First-time customer — no prior order history."
  - "High order value — $2,450.00."
  - "Billing / shipping name mismatch."
  - "Payment pending — authorization not settled."
  - "Refund & Cancel"
  - "Protect your revenue. Automate your operations."

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film — confident restraint, let the fraud score and risk signals carry the drama without hype language
- Interpretation: 4 scenes, longer holds, big serious Inter type, generous negative space, no bounce/elastic easing, deliberate cuts
- Angle: The product's own drama is the hook — a $2,450 first-time-buyer order scores 93/100 on fraud risk. The video watches the AI build its case, then a human make the safe call. Premise: "the AI explains itself, you decide."
- Hook: Hard cut to a single huge red numeral, "93/100", eyebrow "FRAUD SCORE" — no logo yet.
- Outro / punchline: Cut to wordmark "Helix for Commerce" on near-black, tagline beneath, then the URL, all static to close.
- Avoid:
  - Generic SaaS language ("streamline your workflow", etc.)
  - Abstract filler visuals, particle systems, gradients unrelated to the brand
  - Redesigning the product's actual visual identity — reuse its real dark console look

## Visual Identity
- Background: `#0b0f1a` (the app's real dark operations-console background, not the light-mode CSS default)
- Text: `#ffffff` primary, `#94a3b8`-range muted gray for secondary/eyebrow labels
- Accent (safe/confirmed): `#059669` (emerald — Cleared badges, brand mark, the confirmed Refund & Cancel action)
- Accent (risk/critical): `#dc2626` (red — fraud score, risk-signal cards, the flagged order)
- Display font: Inter (project's `--font-sans` / `--font-heading`)
- Body/mono font: Geist Mono (order IDs, scores, mono eyebrows/labels)
- Visual references from the project: the Live Orders Stream table (row-based, colored risk-score chips), the AI Reasoning risk-signal card stack, the HITL decision card with its confidence bar and two-button choice, the dark wordmark lockup used on the product's own title card

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Cold open: the score — 4s — huge red "93/100" count-up over "FRAUD SCORE" eyebrow, on near-black. Holds still and fully readable after landing.
2. Live Orders Stream — 5s — 3 order rows arrive one by one (#1001 Cleared, #1002 Cleared, #1003 Sofia Reyes lands last, visually flagged: red border, boxed amount, amber "Review Needed", red "93" score).
3. AI Reasoning builds its case — 6s — 4 risk-signal cards stack in one by one under the "AI Reasoning · Order #1003 / Fraud Score 93/100" header, each fully readable before the next lands; hold the complete stack briefly at the end.
4. HITL decision + outro — 5s — HITL decision card for Order #1003; "Refund & Cancel" transitions from outline to filled/confirmed (the safe-path payoff); "Approve" stays outline/inert throughout, never filled or emphasized. Hard cut to outro: wordmark + tagline + URL, static, on `#0b0f1a`.

## Audio
- Audio role: intentional silence
- Audio arc: none — fully silent render for this pass
- Music: none (disabled by explicit request — this is a video-only test render)
- Music treatment: n/a
- Music cue guidance: n/a
- Audio-reactive treatment: none
- Audio-coupled moments: none this pass
- SFX selection guidance: none — no SFX in this render
- SFX analysis guidance: n/a
- Exact SFX choice: n/a (no audio layer at all)
- Audio files: none to copy — do not create an `assets/music/` or SFX directory content for this render

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). `/brag` is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project (the AI Reasoning risk-signal cards and the HITL decision card are the required centerpiece).
- Keep all text readable in the final render — every risk-signal card and every headline gets a real hold, not a flash.
- Keep the video within 15-25 seconds (target 20s).
- **No audio layer at all** — this run is explicitly silent (`--no-music --no-sfx`, no voiceover). Do not add music, SFX, or a voiceover track. Do not create audio-reactive bindings.
- **Hard content constraint (non-negotiable):** in Scene 4, the "Approve" button/action must never appear filled, checked, highlighted, or emphasized at any point in the composition. Only "Refund & Cancel" may transition to a filled/confirmed state. This mirrors a corrected product bug — the previous version of this video incorrectly showed "Approved ✓" on a confirmed-fraud order, and that state must not be reproduced here in any frame.
- Run `hyperframes check` before render — it is brag's single gate.
