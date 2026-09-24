# Brag Plan: Helix for Commerce

## What is this app?
A commerce operations console that auto-detects fraud on incoming orders and puts the final call in a human's hands — reject bad revenue with one click instead of guessing.

## The angle
No jokes needed — the product's own drama is the hook: a $2,450 order from a first-time buyer scores 93/100 on fraud risk, and the video's entire arc is watching the AI build the case, then a human make the safe call. The premise is "the AI explains itself, you decide" — confidence without a black box.

## Hook (first 2-3 seconds)
Hard cut on black to a single stat, huge: **93/100** in red, label "FRAUD SCORE" beneath it. No logo yet. The number is the cold open.

## Key moments (the middle)
- The Live Orders Stream table populates row by row (Cleared, Cleared, then #1003 lands red/flagged), ending with the eye landing on Sofia Reyes' $2,450 order.
- The AI Reasoning panel builds its case one risk signal at a time (first-time customer → high value → billing/shipping mismatch → payment pending), each landing like a stamped verdict.
- The HITL decision card: two buttons present (Approve · Refund & Cancel), then **Refund & Cancel becomes the filled, confirmed action** — this is the corrected safe-path moment, the emotional payoff of the whole build-up.

## Outro / punchline
Cut to the wordmark on near-black: "Helix for Commerce." Tagline beneath: "Protect your revenue. Automate your operations." Hold, then the URL.

## User flow worth showing
Entry → key action → result: Order lands in Live Orders Stream flagged Review Needed → AI Reasoning panel surfaces the risk signals → human confirms Refund & Cancel and the order re-labels as resolved/cancelled. This is the real HITL fraud-review flow, not a landing-page recreation.

## Tone
- Preset: polished
- Creative direction: quiet premium product film — confident restraint, let the fraud score and the risk signals carry the drama without hype language
- Interpretation: Fewer, longer-held scenes (3-4). Big serious type, generous negative space, no jokes, no bounce — cuts feel deliberate, not playful. The tension is real (a fraud case), so the pacing should feel controlled, not frantic.

## Format: landscape — 1920x1080
## Duration: 20s

## Visual identity (from the project)
- Background: `#0b0f1a` (near-black, matches the app's own dark operations console — confirmed from the live captured UI, not the light-mode CSS default)
- Accent (safe/primary): `#059669` (emerald — used for Cleared badges, the confirmed HITL action, brand mark)
- Accent (risk/critical): `#dc2626` (red — fraud score, risk signal cards)
- Text: `#ffffff` primary / `#94a3b8`-ish muted gray for secondary labels
- Display font: Inter (the app's own --font-sans / --font-heading)
- Body/mono font: Geist Mono (data labels, scores, order IDs)
- Strongest visual element: the AI Reasoning panel's stacked risk-signal cards (red left-border, monospace "RISK SIGNAL" eyebrow) — this is the single most video-worthy UI moment in the product

## Share copy (draft)
Helix for Commerce catches the fraud, explains its reasoning, and lets a human make the call — Refund & Cancel, not a blind Approve.

## Audio direction
- Role: none — video-only render for this pass, no music/SFX/voice
- Music: none (disabled for this run)
- Music treatment: n/a
- Music cue guidance: n/a
- Audio-reactive treatment: none
- SFX posture: none
- Audio-coupled moments: none this pass — motion timing should still read as deliberate/confident without audio reinforcement
- Restraint rule: no audio at all in this render

## Storyboard

### Scene 1 — Cold open: the score — 4s
Hard cut on `#0b0f1a`. Center-frame, huge Inter numeral "93/100" in `#dc2626`, with a small Geist Mono eyebrow above it: "FRAUD SCORE". Number does a fast, confident count-up from 0 to 93 (under 0.6s), then holds fully still and readable for the remainder — no bounce, no glow pulse.
Sequential/interaction: yes — the numeral counts up once, then holds.
Audio intent: none (silent).
Audio-coupled idea: none.
Music: none.
Transition mood: hard, clean cut → Scene 2.

### Scene 2 — Live Orders Stream — 5s
The Live Orders Stream table card (dark surface, emerald "LIVE ORDERS STREAM" eyebrow) builds row by row: #1001 Marcus Chen (Cleared, score 12) lands first, then #1002 Ava Patel (Cleared, score 8), then #1003 Sofia Reyes lands last and distinctly — red left-border accent, "$2,450.00" boxed in red, status "Review Needed" in amber, score "93" in red. Camera holds on the completed table with #1003 clearly the visual anomaly among clean green rows.
Sequential/interaction: yes — 3 rows arrive one by one, #1003 lands with visible emphasis (color, border) distinct from the two Cleared rows before it.
Audio intent: none (silent).
Audio-coupled idea: none.
Music: none.
Transition mood: clean crossfade → Scene 3.

### Scene 3 — AI Reasoning builds its case — 6s
Cut to the AI Reasoning panel: header "AI Reasoning · Order #1003" with "Fraud Score 93/100" in red at top-right. Four risk-signal cards stack in one by one, each with a red left border and a small "RISK SIGNAL" mono eyebrow: "First-time customer — no prior order history", "High order value — $2,450.00", "Billing / shipping name mismatch", "Payment pending — authorization not settled". Each card lands with enough hold to read before the next arrives. After all four are on screen, hold the full stack for a beat.
Sequential/interaction: yes — 4 risk-signal cards arrive one by one, each fully readable before the next lands (this is the plan's strongest sequential-reveal moment — do not rush it).
Audio intent: none (silent).
Audio-coupled idea: none.
Music: none.
Transition mood: clean crossfade → Scene 4.

### Scene 4 — HITL decision: Refund & Cancel, then outro — 5s
Cut to the HITL decision card: "Order #1003 — Sofia Reyes" / "$2,450.00 · AI Fraud Score 93/100 · Review Needed" with an AI-confidence bar at 93%. Two buttons are present — "Approve" (outline only, never filled, never touched) and "Refund & Cancel" (outline at first). Refund & Cancel becomes the filled emerald confirmed action — this is the corrected safe-path moment and must read unambiguously as the chosen action; Approve must never appear filled, checked, or emphasized at any point in this scene. Immediately after, hard cut to the outro: near-black `#0b0f1a` ground, Helix wordmark ("Helix" white + "for Commerce" emerald), tagline "Protect your revenue. Automate your operations." beneath, then the URL in Geist Mono, all held static to close.
Sequential/interaction: yes — Refund & Cancel visibly transitions from outline to filled/confirmed; Approve stays outline/inert throughout.
Audio intent: none (silent).
Audio-coupled idea: none.
Music: none.
Transition mood: hard cut → end.

**Music mood for this video:** none (disabled — video-only test render)
**Audio summary:** Fully silent render. This pass validates visual style and pacing only; audio direction will be revisited in a later pass if this style is approved.
