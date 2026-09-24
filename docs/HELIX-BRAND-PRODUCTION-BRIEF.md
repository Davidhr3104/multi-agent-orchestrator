# Helix Brand Ads — Production Brief (inspiración consolidada)

**For:** David Herrera / Hyperframes  
**Date:** 18 Sep 2026  
**Goal:** Brand spots que **venden** Helix (estilo anuncio de marca grande), no tours de UI.  
**Duration rule:** **mínimo 60 segundos** por video (ideal Commerce **60–75s**; OK hasta ~90s si el arco lo pide).  
**Language of VO:** English (estilo Yaveon). Español 1:1 si grabás LatAm.

---

## 1. Inspiration stack (canon)

| # | URL | Qué es | Qué copiar | Qué no copiar ciego |
|---|-----|--------|------------|---------------------|
| A | https://www.youtube.com/watch?v=jX4dLxiso6A | **Doks.AI** short ad (Zelios) ~**20s** | Dark mode, glass UI en 3D, glow neon, cuts al beat, SFX, click+ripple, densidad de craft | Runtime de 20s; UI genérica sin datos reales |
| B | https://www.youtube.com/watch?v=bQnSSVESxl4 | **Breakout Blocks** ~**2:18** | Estructura en actos, type cards con aire, duración larga, iconos flotantes, narrativa | Volverse lento/vacío; light-mode purple si Helix es dark |
| C | https://www.youtube.com/watch?v=FTYeji9xtVk | **Yaveon** “Technology meets humanity” ~**85s** | **La VO**: female EN-US, warm, slow, intimate, close-mic | El look visual exacto (ellos son más corporate manifesto) |

**Fórmula Helix =** craft Doks + arco Breakout (≥60s) + voz Yaveon + **verdad de producto** (seed live).

---

## 2. Non-negotiable product truth

### Todos los Helix
- Solo URLs Vercel Helix reales (abajo).
- Números = **seed live después de hidratar**.
- UI puede ser glass/3D, pero botones/datos = producto real (rebuild vector OK).
- Export: 1920×1080, bitrate decente (**8–12 Mbps**), **siempre con audio**.

### Commerce (P0)
- Order **#1003** Sofia Reyes → **Refund & Cancel** (preferible **rojo/danger**).
- **Nunca Approve** tras fraude confirmado.
- Stats: ~**$5,865.50** revenue · **5** orders · **6** products · **3** urgent inventory.
- Shopify en Settings = Not configured → CTA honesto (“demo / connect when ready”).
- Quitar copy tipo “From seeded mock orders” en el ad.

### Legal
- “**Not legal advice**” on-camera.
- No lawyer / SAM.gov claims.

### Leads
- Solo https://helix-for-leads.vercel.app — nunca lead-scoring-demo.vercel.app.
- Wire `/help` para hostear el MP4.

### Inbox
- Triage de mail — **not lead scoring**.
- KPIs live ~ Open 4 / Review 2 / Urgent 2 / Blocked 1.

### Orchestrator
- Content pipeline + HITL + export — **not CRM / lead scoring**.

### Record URLs
| Product | URL |
|---------|-----|
| Commerce | https://helix-for-commerce.vercel.app |
| Legal | https://helix-for-legal.vercel.app |
| Leads | https://helix-for-leads.vercel.app |
| Inbox | https://helix-for-inbox.vercel.app |
| Orchestrator | https://multi-agent-orchestrator-mu.vercel.app |

---

## 3. Visual craft bible (from Doks + Breakout)

### Do
1. Dark charcoal/black base; **one accent** per product (Commerce = emerald/mint).
2. UI as **physical glass panels**: slight tilt, Z-depth, soft glow, edge light.
3. Big kinetic type cards between product beats.
4. **Click moments** with cursor + ripple + SFX (especially HITL).
5. Music + SFX on every major cut; VO calm on top (Yaveon contrast).
6. End lockup ≥**3s**: name + short line + URL (URL smaller).
7. Crossfades / push-ins — avoid long pure-black “orb” holds.

### Don’t
1. Silent export (no audio track).
2. Ultra-low bitrate (~234 kb/s looks soft).
3. 5–10s static holds with no motion/SFX.
4. Fake mega-KPIs ($128k / 1,248 orders, etc.).
5. Tiny bottom-left caption chips.
6. Approve-on-fraud (Commerce).

### Accent colors
| Helix | Accent |
|-------|--------|
| Commerce | Emerald / mint |
| Legal | Gold |
| Leads | Cyan |
| Inbox | Violet |
| Orchestrator | Cool white / silver |

---

## 4. Voice bible (from Yaveon FTYeji9xtVk)

### Profile (confirmed)
- **Female**, young adult (~25–35)
- **North American English**
- Warm, human, intimate — not stiff announcer
- **Slow** ~**100–110 WPM** with long pauses
- Lower-mid, slightly breathy; quiet confidence (downward inflection)
- Close-mic (proximity); sits **above** driving music
- Style: modern Apple/human-tech brand, not YouTuber hype

### Exemplar feel
> “Positive change… begins… with a clear vision.”  
> “Technology meets approachability.”

### ElevenLabs / AI VO recipe
**Tags:** `young female`, `American`, `warm`, `calm`, `intimate`, `conversational`, `slow`, `soft-spoken`, `close-mic`  
**Archetypes:** meditation / narrative / “ASMR-lite” commercial — try Rachel, Matilda, Nicole + high Stability, low Style  
**Script punctuation:** use `...` and commas to force pauses  
**Avoid:** `energetic`, `promo`, `announcer`, sharp high-pitch hype  

**Generation prompt:**
```
Warm, calm, premium B2B brand narrator. Young adult female, American English.
Human and trustworthy, never hype. Slow measured pace (~105 WPM) with natural pauses.
Close-mic, intimate, quiet confidence. Technology meets humanity.
```

### Word budget
At ~105 WPM → **60s ≈ 90–110 words**. Keep VO sparse; let type + UI carry technical detail.

---

## 5. Duration architecture (≥60s)

**Not** a 20s Doks clone. Use Doks **density** inside a Breakout-like **arc**:

| Act | Time (60–75s spot) | Purpose |
|-----|--------------------|---------|
| 1 Hook | 0:00–0:08 | Problem / desire in type |
| 2 Promise | 0:08–0:16 | What Helix is *for* |
| 3 Proof A | 0:16–0:32 | First live UI beat |
| 4 Proof B + HITL | 0:32–0:50 | Decision / human gate |
| 5 Bridge | 0:50–0:58 | Brand line |
| 6 Proof C (optional) | 0:58–1:06 | Second surface (inventory, etc.) |
| 7 Land | 1:06–1:15+ | Logo + CTA ≥3s |

Average visual change every **~2–3s**, but total runtime **≥60s**.

---

## 6. Critique notes — current Commerce `brand-ad.mp4`

Path (Deveku):  
`C:\Users\devex\projects\helix-lead-scoring-template\apps\commerce\brand-ad-output\brand-ad.mp4`

### What already works
- Hook type: “One bad order can wipe a good day.”
- Promise: “The ops desk that catches risk before it ships.”
- Live stats ($5,865.50 / 5 / 3)
- #1003 risk 93 highlighted
- HITL with Refund & Cancel as primary (content P0 fixed vs old howto)
- End card: Helix for Commerce · Protect the order · URL

### Must fix in next cut
1. **Add audio** (VO Yaveon-style + music + SFX) — current file has **no audio stream**
2. Raise **bitrate** (was ~234 kb/s)
3. Kill long black/logo voids; keep motion or type
4. Show **cursor click + confirmation** on Refund & Cancel
5. Prefer **red/danger** for Refund & Cancel (green reads as Approve)
6. Remove “From seeded mock orders”
7. Keep duration **≥60s** but fill with craft, not empty air
8. End card hold ≥3s; URL secondary to brand line

---

## 7. Commerce — production pack (priority)

**Working title:** *Protect the order.*  
**Target:** **60–70s**  
**URL to record / rebuild from:** https://helix-for-commerce.vercel.app  

### DO / DON’T
- **DO:** Hook type → KPIs live → #1003 → HITL Refund & Cancel + confirm → inventory → brand land  
- **DON’T:** Approve #1003; fake Shopify live; mega revenue; silent export  

### Shot list (60–70s)
| Time | Visual |
|------|--------|
| 0:00–0:06 | Black → type: **One bad order can wipe a good day.** + soft SFX |
| 0:06–0:14 | Type: **The ops desk that catches risk before it ships.** · Helix mark |
| 0:14–0:24 | Glass KPI cards: **$5,865.50** · **5** orders · **3** inventory alerts (motion in) |
| 0:24–0:36 | Live Orders Stream — #1003 Sofia Reyes **$2,450** · risk **93** · Review Needed |
| 0:36–0:50 | HITL card → cursor → click **Refund & Cancel** (red) → ripple/confirm |
| 0:50–0:58 | Type: **Bad revenue never clears.** |
| 0:58–1:06 | Inventory urgents (3 items) — same desk |
| 1:06–1:12 | Type: **Protect the order.** |
| 1:12–1:18+ | **Helix for Commerce** · URL · hold ≥3s |

### VO SCRIPT (Yaveon style · ~95 words · English)

**[0:00–0:08]**  
One bad order… can wipe a good day.

**[0:08–0:16]**  
Helix for Commerce… is the ops desk that catches risk… before it ships.

**[0:16–0:28]**  
This is the live demo. Real seed numbers. Revenue… orders… inventory… one place.

**[0:28–0:40]**  
Open the queue. Order one-zero-zero-three needs a human. High fraud risk. High value.

**[0:40–0:52]**  
Review the signals… then choose the safe path. Refund and Cancel. Helix flags. You decide.

**[0:52–1:02]**  
Same desk… next risk. Inventory… about to stock out.

**[1:02–1:12]**  
Helix for Commerce. Protect the order.  
Open the demo… and connect Shopify when you’re ready.

### Captions
- Centered lower-third OR rely on kinetic type (Yaveon/Doks hybrid).  
- On decision beat: **Refund & Cancel — never Approve.**  
- Optional burned captions matching VO; large, clean.

### End card
**HELIX FOR COMMERCE**  
Protect the order.  
https://helix-for-commerce.vercel.app

### Music / SFX
- Bed: modern electronic, mid energy (Breakout/Doks family) — not overpowering VO  
- SFX: whoosh on card in, click + ripple on Refund, soft confirm chime  
- Duck music ~3–6 dB under VO  

---

## 8. Other Helix — short briefs (same stack)

### Legal · 60–70s · https://helix-for-legal.vercel.app
**Sell:** Bid with eyes open.  
**Proof:** Ingest RFP → NO-GO/CONDITIONAL → deadlines → **not legal advice**.  
**VO tone:** Same Yaveon female calm.  
**Accent:** Gold.

### Leads · 60–70s · https://helix-for-leads.vercel.app
**Sell:** Score. Then decide.  
**Proof:** Live KPIs → lead/spam/info → Ava-style HITL → approve/revise/block.  
**Also ship:** `/help` page hosting MP4.  
**Accent:** Cyan.

### Inbox · 60–65s · https://helix-for-inbox.vercel.app
**Sell:** Mail that moves.  
**Proof:** Live KPIs (~4/2/2/1) → thread → HITL approve/route/block.  
**Not** lead scoring.  
**Accent:** Violet.

### Orchestrator · 60–75s · https://multi-agent-orchestrator-mu.vercel.app
**Sell:** Many agents. One signature.  
**Proof:** Seed pipeline → evidence/confidence → HITL → export JSON/PDF.  
**Not** CRM / lead scoring.  
**Accent:** Cool white/silver.

*(Full longer scripts still available in `HELIX-BRAND-ADS-SCRIPTS.md` and `hyperframes/*.md` — trim VO to ~90–110 words using this Yaveon pace.)*

---

## 9. Global production checklist

- [ ] Duration **≥ 60s**
- [ ] Audio muxed (VO + music + SFX)
- [ ] Yaveon-style female EN-US VO (~100–110 WPM, ≤110 words / 60s)
- [ ] Doks craft: glass, glow, click+ripple, beat-synced cuts
- [ ] Breakout structure: multi-act, not one continuous hold
- [ ] Live seed numbers only
- [ ] Commerce: Refund & Cancel confirmed in final cut (never Approve)
- [ ] No “seeded mock orders” on-screen
- [ ] Bitrate 8–12 Mbps 1080p H.264 (or ProRes master)
- [ ] End card ≥3s with readable URL
- [ ] Replace assets via Helix-Personal → `apps/*/public/help/*.mp4`

---

## 10. Recommended build order

1. **Commerce** brand-ad v2 (fix this brief)  
2. Leads (+ `/help` wire)  
3. Legal  
4. Inbox  
5. Orchestrator (first-ever howto/brand)

---

## 11. Related files on box

| File | Purpose |
|------|---------|
| `/workspace/helix-qa/videos/HELIX-BRAND-PRODUCTION-BRIEF.md` | **This document** |
| `/workspace/helix-qa/videos/HELIX-BRAND-ADS-SCRIPTS.md` | Earlier Apple-style scripts (trim VO length) |
| `/workspace/helix-qa/videos/HYPERFRAMES-PRODUCTION-PACK.md` | Howtos + timed VO packs |
| `/workspace/helix-qa/videos/inspiration/DOKS-AI-STYLE-BIBLE-FOR-HELIX.md` | Doks-only style bible |
| `/workspace/helix-qa/videos/COMMERCE-DETAIL-REVIEW.md` | Old howto P0 review |
| Inspiration downloads | `inspiration/ref-doks-ai.mp4`, `ref-bQnSSVESxl4.mp4`, `ref-voice-FTYeji9xtVk.mp4` |

---

*Sources: Doks.AI ad, Breakout Blocks intro, Yaveon brand film, Commerce brand-ad QA, Helix product QA 16–18 Sep 2026.*
