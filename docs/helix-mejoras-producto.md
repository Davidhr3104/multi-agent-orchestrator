# Helix — Roadmap de mejoras por producto

Lista consolidada: valor de mercado + robustez operativa + 10 extras por Helix (Leads, Marketing, Legal, Inbox, Commerce) y capa de familia.

| | |
|---|---|
| **Audiencia** | Producto / ops / founders Helix |
| **Criterio** | Dinero recuperado, riesgo reducido u horas de operador — no polish cosmético |
| **Barra de producto** | Inbound vivo → evidencia + HITL → write-back → métrica → audit → roles |
| **Fecha** | Septiembre 2026 |

**Orden de inversión sugerido:** 1) Leads closed-loop ROI · 2) Marketing Ads read + $ on spam · 3) Familia auth/roles · 4) Legal corpus + win-rate · 5) Inbox OAuth + thread · 6) Commerce webhooks + $ saved

---

## Contenido

1. [Capa de familia (plataforma)](#1-capa-de-familia)
2. [Helix for Leads](#2-helix-for-leads)
3. [Helix for Marketing](#3-helix-for-marketing)
4. [Helix for Legal](#4-helix-for-legal)
5. [Helix for Inbox](#5-helix-for-inbox)
6. [Helix for Commerce](#6-helix-for-commerce)
7. [Resumen de prioridades](#7-resumen-de-prioridades)

---

## 1. Capa de familia

Sin esto cada Helix es una app suelta. Con esto es plataforma revendible.

### A · Valor de mercado

1. Control plane único (workspaces + SSO)
2. Roles: owner / operator / viewer
3. Audit export (CSV/PDF) cross-desk
4. Billing + usage metering
5. White-label agencia (logo, dominio)
6. Cross-desk events (Lead won → Marketing ROI)

### B · Robustez de producto

1. Tenancy real (Supabase org / RLS)
2. OAuth apps (no paste de tokens)
3. Webhooks inbound + retry + DLQ
4. Notificaciones (email + Slack + in-app)
5. SLA / assignment / handoff multi-usuario
6. Retention + PII redaction
7. Health dashboard de conectores
8. Playbooks + empty states + demo → live

### C · 10 extras adicionales

1. Status page pública por cliente (uptime de desks)
2. Feature flags por workspace / plan
3. Impersonation auditada para soporte
4. Data residency opción (US / EU)
5. SOC2-ready logging (quién, qué, cuándo, por qué)
6. SDK / CLI para operadores y partners
7. Marketplace de “score packs” y playbooks verticales
8. Unified search cross-desk (lead, RFP, order, thread)
9. Onboarding checklist compartida familia
10. Contrato de SLA comercial + créditos por downtime

---

## 2. Helix for Leads

Desk de scoring + HITL + write-back a CRM. El más vendible hoy; el salto es closed-loop de dinero y ops de equipo.

| | |
|---|---|
| **Hoy** | GHL webhook, score, inbox HITL, CRM write-back |
| **Falta** | ROI ganado/perdido, multi-CRM, equipo multi-usuario |
| **North star** | $ influenciado por Helix / mes y % hot leads contactados en < 15 min |

### A · Valor de mercado (sube el precio)

1. Closed-loop ROI: won/lost → “Helix pagó $X este mes” (dashboard cliente)
2. Routing real a pipeline GHL (no solo upsert de contacto)
3. Booking real (Calendly/Cal.com OAuth + slot confirmado en el lead)
4. White-label para agencias que lo revenden a HVAC / dental / home services
5. Slack/Teams approve-from-chat (link firmado + acción sin abrir desk)
6. Score explainability exportable al cliente final (PDF de 1 página)

### B · Robustez (deja de ser app simple)

1. HubSpot + Salesforce conectores (parity con GHL)
2. Asignación a reps reales: round-robin, capacity, territory
3. Enrichment serio (Clearbit/Apollo/ZoomInfo o partner) + dedupe
4. Funnel stages con SLA (time-to-first-touch, stale alerts)
5. Bulk ops + keyboard queue (velocidad de operador)
6. Webhook outbound firmado hacia sistemas del cliente
7. A/B de prompts de scoring con shadow mode antes de producción
8. Mobile-friendly review queue (ops en campo)

### C · 10 extras adicionales

1. Lead lifecycle timeline unificada (ingest → score → contact → won/lost)
2. Compliance mode: PII masking en exports y pantallas de demo
3. Score drift monitor (calidad del modelo semana a semana)
4. Plantillas de outreach por vertical con variables del lead
5. Integración Zapier/Make como puente para CRMs long-tail
6. Cola de “leads zombie” con campañas de resurrect programadas
7. Mapa de fuentes: qué canal trae hot vs spam (por cliente)
8. Modo agencia: N workspaces de clientes bajo una cuenta madre
9. API pública versionada + sandbox keys para integradores
10. Onboarding wizard: conectar GHL → test webhook → primer lead en < 10 min

---

## 3. Helix for Marketing

Join spend ↔ scored leads. El mercado compra “deja de pagar spam”, no otro dashboard de CPL.

| | |
|---|---|
| **Hoy** | CSV spend, sync Leads, join/remap, HITL pause/scale local |
| **Falta** | Ads read automático, write a Ads Manager, métrica $ on spam |
| **North star** | % spend en leads no-calificados y $/hot lead vs baseline |

### A · Valor de mercado (sube el precio)

1. Métrica hero: $ spent on spam / cost-per-hot (no solo CPL)
2. Meta + Google Ads read-only automático (adiós CSV diario)
3. Pause / scale write-back a Ads Manager (después de read estable)
4. Benchmarks por vertical (HVAC vs dental vs legal ads)
5. Daily brief automático: “ayer quemaste $X en 3 campañas”
6. Agency multi-account: N ad accounts, 1 desk, client switcher

### B · Robustez (deja de ser app simple)

1. OAuth Meta Marketing API + Google Ads API (sin keys stub)
2. Identity resolution: unmatched → reglas + fuzzy + learn-from-remap
3. Attribution windows configurables + multi-touch light
4. Budget pacing alerts (overspend mid-day)
5. Creative / ad-set drill-down ligado a calidad de lead
6. Guardrails: nunca pause sin HITL + audit
7. Import histórico 90 días en onboarding
8. Conector nativo a Helix Leads con health check bi-direccional

### C · 10 extras adicionales

1. Alertas de fatiga creativa (CTR ↓ + CPL ↑ por ad)
2. Geo / device / audience breakdown cruzado con score Helix
3. Reglas de “kill switch” por umbral de spam % (propuesta → HITL)
4. Comparador before/after de decisiones de pause/scale
5. Etiquetado de campañas por objetivo (lead gen, remarketing, brand)
6. Export semanal a Slack/email para el cliente final
7. Soporte a UTM governance (detectar UTM rotas / duplicadas)
8. Simulador de presupuesto: “si mueves $X aquí, hot leads estimados”
9. Conector TikTok Ads (read) como tercera fuente
10. Playbooks de remediación por vertical (checklist accionable)

---

## 4. Helix for Legal

Partner Go/No-Go con cites. Vende no bidear basura y no chocar COI — no “AI summary”.

| | |
|---|---|
| **Hoy** | RFP ingest PDF/DOCX, partner verdict, deadlines, pricing memory |
| **Falta** | Corpus real, win-rate, write-back externo a DMS/CLM |
| **North star** | Horas partner ahorradas + % NO-GO correctos + cite accuracy |

### A · Valor de mercado (sube el precio)

1. Win-rate dashboard: GO/CONDITIONAL/NO-GO → won/lost + $ pipeline
2. Firm book editable (rates, matter types, no-bid rules) versionado
3. COI checks contra matters reales (no solo heurística local)
4. Deadline pack: calendar OAuth + alerts 7/3/1 con escalation
5. Proposal / Word export listo para partner
6. Corpus de la firma con cites reales (RAG + pgvector, no mock)

### B · Robustez (deja de ser app simple)

1. Eliminar corpusStatus mocked o marcar UI “unavailable” hasta live
2. DMS connectors (iManage / NetDocuments / SharePoint)
3. Matter / CLM light write-back (Clio, PracticePanther o custom)
4. Comms log + privilege flags en cada decisión
5. Multi-office workspaces con conflict walls
6. Immutable audit + retention policies
7. RFP intake portal para clientes (sin darles el desk completo)
8. Model eval harness: cite accuracy % tracked over time

### C · 10 extras adicionales

1. Checklist de red flags por practice area (auto-sugerida)
2. Comparador de RFPs similares (precedentes internos)
3. Pricing suggestion engine con historial de deals cerrados
4. Staffing hint: socios/asociados sugeridos por expertise
5. Export de decision memo (1–2 páginas) con cites ancladas
6. Integración Outlook para deadlines y follow-ups
7. Modo “second partner review” para bids > umbral $
8. Taxonomía de razones NO-GO (analytics de rechazo)
9. Sandbox de prompts legales versionados por firma
10. Certificación de fuentes: cada cite con page/span verificable

---

## 5. Helix for Inbox

Triage + HITL + send. El mercado compra tiempo y “nada sale sin humano”; hoy el mail es frágil.

| | |
|---|---|
| **Hoy** | Paste ingest, Gmail token sync, Resend send, HITL queue |
| **Falta** | OAuth estable, reply-in-thread, multi-canal |
| **North star** | Median time-to-first-human-reply y % drafts enviados sin editar |

### A · Valor de mercado (sube el precio)

1. Gmail / Workspace OAuth app + refresh tokens (install 1-click)
2. Reply-in-thread vía Gmail API (no Resend paralelo al mailbox)
3. SLA time-to-reply por categoría / VIP
4. Handoff a Slack + Helix Leads (lead detectado → desk)
5. Shared mailbox / alias support (ops@, support@)
6. Weekly “hours saved” report para EA / founder

### B · Robustez (deja de ser app simple)

1. Microsoft 365 / Outlook parity
2. Assignment + presence (quién tiene el thread)
3. Snooze / follow-up reminders que sobreviven refresh
4. VIP + blocklists sync desde contacts CRM
5. Attachment / phishing heuristics + quarantine
6. Audit de envíos (quién aprobó el draft)
7. Multi-mailbox tenants con RLS
8. Smart-reply con Claude + style guide por workspace

### C · 10 extras adicionales

1. Detección de urgencia + intent (billing, sales, support, spam)
2. Plantillas aprobadas por categoría con variables
3. Escalation ladder (ops → manager → founder) por SLA breach
4. Digest matutino: “12 pendientes, 3 VIP, 1 SLA en riesgo”
5. Modo vacation / out-of-office consciente del desk
6. Búsqueda full-text + filtros guardados por operador
7. Thread merge / split para conversaciones mezcladas
8. Política de retención y borrado automático de spam
9. Webhook inbound desde formularios web → cola HITL
10. KPI de “first draft acceptance rate” por operador

---

## 6. Helix for Commerce

Fraud + fulfill HITL sobre Shopify. Vende $ at risk / $ saved, no otro admin de tienda.

| | |
|---|---|
| **Hoy** | Shopify sync, fraud review, fulfill/cancel live |
| **Falta** | Webhooks vivos, métrica $ saved, inventory write-back |
| **North star** | $ fraud blocked / mes y fulfill SLA (time-to-ship post-approve) |

### A · Valor de mercado (sube el precio)

1. Métrica hero: $ at risk blocked + $ saved vs chargebacks
2. Shopify webhooks (orders/create, fulfillments, refunds) en vivo
3. Fraud signals nativos Shopify + Helix score unificado
4. Inventory reorder write-back (draft PO / low-stock action)
5. Returns / RMA desk ligero (approve refund / restock)
6. Daily ops brief: “3 órdenes high-risk, $X hold”

### B · Robustez (deja de ser app simple)

1. Multi-store / multi-currency
2. Webhook signature verify + idempotency + replay
3. Chargeback evidence pack export
4. Customer risk graph (repeat fraud rings)
5. Catalog CSV import completo + bulk review
6. Inquiry → quote → order path con HITL
7. Guardrails: cancel/fulfill siempre operator-gated + audit
8. Health: last webhook, API rate limits, sync lag

### C · 10 extras adicionales

1. Hold automático de fulfillment si score > umbral (con override HITL)
2. Detección de address mismatch / velocity / gift-card abuse
3. Cola de “manual capture” para pagos en riesgo
4. Alertas de stockout predicho por SKU (7/14 días)
5. Bundle / kit inventory awareness en reorder
6. Integración 3PL / shipping labels post-approve
7. Customer notes sync a Shopify (decisión Helix visible en admin)
8. Modo Black Friday: umbrales y staffing de cola adaptativos
9. Replay tool para re-procesar webhooks fallidos
10. Dashboard de “false positive rate” del fraud model

---

## 7. Resumen de prioridades

Qué mover primero si el objetivo es producto robusto + ticket más alto.

| Prioridad | Desk | Slice | Por qué |
|-----------|------|-------|---------|
| P0 | Leads | Closed-loop ROI | Historia de venta más clara |
| P0 | Marketing | Ads read + $ on spam | Dolor diario de agencias |
| P0 | Familia | Auth / roles / audit | Base para vender SaaS |
| P1 | Legal | Corpus + win-rate | Trust + precio mid-market |
| P1 | Inbox | OAuth + reply-in-thread | Sin esto no hay producto mail |
| P1 | Commerce | Webhooks + $ saved | Ops real, no sync manual |

**Regla:** cada mejora debe mover **dinero recuperado**, **horas de ops** o **riesgo**. Si no, es polish y va al final.

---

*Total: ~144 mejoras (24 familia + 5 desks × 24).*

*Fuente: `docs/helix-mejoras-producto.pdf`*
