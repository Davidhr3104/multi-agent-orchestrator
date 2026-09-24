"""Generate Helix product improvements PDF."""
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent / "helix-mejoras-producto.pdf"

INK = HexColor("#0F172A")
MUTED = HexColor("#475569")
ACCENT = HexColor("#0EA5E9")
LINE = HexColor("#E2E8F0")
SOFT = HexColor("#F8FAFC")

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=26,
        leading=32,
        textColor=INK,
        spaceAfter=8,
        alignment=TA_LEFT,
    )
)
styles.add(
    ParagraphStyle(
        name="CoverSub",
        fontName="Helvetica",
        fontSize=11,
        leading=16,
        textColor=MUTED,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="H1Doc",
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=INK,
        spaceBefore=4,
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        name="H3Doc",
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=14,
        textColor=ACCENT,
        spaceBefore=10,
        spaceAfter=4,
    )
)
styles.add(
    ParagraphStyle(
        name="BodyDoc",
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        textColor=INK,
        spaceAfter=4,
        alignment=TA_JUSTIFY,
    )
)
styles.add(
    ParagraphStyle(
        name="ItemDoc",
        fontName="Helvetica",
        fontSize=9,
        leading=12.5,
        textColor=INK,
        leftIndent=4,
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="MetaDoc",
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=MUTED,
        spaceAfter=2,
    )
)
styles.add(
    ParagraphStyle(
        name="TOCItem",
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=INK,
        spaceAfter=4,
    )
)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(0.75 * inch, 0.55 * inch, letter[0] - 0.75 * inch, 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, 0.35 * inch, "Helix · Roadmap de producto · Confidencial")
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.35 * inch, f"{doc.page}")
    canvas.restoreState()


def section_header(title, subtitle):
    return [
        Paragraph(title, styles["H1Doc"]),
        Paragraph(subtitle, styles["MetaDoc"]),
        HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=2, spaceAfter=10),
    ]


def bullet_block(items):
    return [Paragraph(f"<b>{i}.</b>  {t}", styles["ItemDoc"]) for i, t in enumerate(items, start=1)]


PRODUCTS = [
    {
        "name": "Helix for Leads",
        "pitch": (
            "Desk de scoring + HITL + write-back a CRM. El más vendible hoy; "
            "el salto es closed-loop de dinero y ops de equipo."
        ),
        "today": "GHL webhook, score, inbox HITL, CRM write-back",
        "gap": "ROI ganado/perdido, multi-CRM, equipo multi-usuario",
        "north": "$ influenciado por Helix / mes y % hot leads contactados en &lt; 15 min",
        "market": [
            "Closed-loop ROI: won/lost → “Helix pagó $X este mes” (dashboard cliente)",
            "Routing real a pipeline GHL (no solo upsert de contacto)",
            "Booking real (Calendly/Cal.com OAuth + slot confirmado en el lead)",
            "White-label para agencias que lo revenden a HVAC / dental / home services",
            "Slack/Teams approve-from-chat (link firmado + acción sin abrir desk)",
            "Score explainability exportable al cliente final (PDF de 1 página)",
        ],
        "robust": [
            "HubSpot + Salesforce conectores (parity con GHL)",
            "Asignación a reps reales: round-robin, capacity, territory",
            "Enrichment serio (Clearbit/Apollo/ZoomInfo o partner) + dedupe",
            "Funnel stages con SLA (time-to-first-touch, stale alerts)",
            "Bulk ops + keyboard queue (velocidad de operador)",
            "Webhook outbound firmado hacia sistemas del cliente",
            "A/B de prompts de scoring con shadow mode antes de producción",
            "Mobile-friendly review queue (ops en campo)",
        ],
        "extra10": [
            "Lead lifecycle timeline unificada (ingest → score → contact → won/lost)",
            "Compliance mode: PII masking en exports y pantallas de demo",
            "Score drift monitor (calidad del modelo semana a semana)",
            "Plantillas de outreach por vertical con variables del lead",
            "Integración Zapier/Make como puente para CRMs long-tail",
            "Cola de “leads zombie” con campañas de resurrect programadas",
            "Mapa de fuentes: qué canal trae hot vs spam (por cliente)",
            "Modo agencia: N workspaces de clientes bajo una cuenta madre",
            "API pública versionada + sandbox keys para integradores",
            "Onboarding wizard: conectar GHL → test webhook → primer lead en &lt; 10 min",
        ],
    },
    {
        "name": "Helix for Marketing",
        "pitch": (
            "Join spend ↔ scored leads. El mercado compra “deja de pagar spam”, "
            "no otro dashboard de CPL."
        ),
        "today": "CSV spend, sync Leads, join/remap, HITL pause/scale local",
        "gap": "Ads read automático, write a Ads Manager, métrica $ on spam",
        "north": "% spend en leads no-calificados y $/hot lead vs baseline",
        "market": [
            "Métrica hero: $ spent on spam / cost-per-hot (no solo CPL)",
            "Meta + Google Ads read-only automático (adiós CSV diario)",
            "Pause / scale write-back a Ads Manager (después de read estable)",
            "Benchmarks por vertical (HVAC vs dental vs legal ads)",
            "Daily brief automático: “ayer quemaste $X en 3 campañas”",
            "Agency multi-account: N ad accounts, 1 desk, client switcher",
        ],
        "robust": [
            "OAuth Meta Marketing API + Google Ads API (sin keys stub)",
            "Identity resolution: unmatched → reglas + fuzzy + learn-from-remap",
            "Attribution windows configurables + multi-touch light",
            "Budget pacing alerts (overspend mid-day)",
            "Creative / ad-set drill-down ligado a calidad de lead",
            "Guardrails: nunca pause sin HITL + audit",
            "Import histórico 90 días en onboarding",
            "Conector nativo a Helix Leads con health check bi-direccional",
        ],
        "extra10": [
            "Alertas de fatiga creativa (CTR ↓ + CPL ↑ por ad)",
            "Geo / device / audience breakdown cruzado con score Helix",
            "Reglas de “kill switch” por umbral de spam % (propuesta → HITL)",
            "Comparador before/after de decisiones de pause/scale",
            "Etiquetado de campañas por objetivo (lead gen, remarketing, brand)",
            "Export semanal a Slack/email para el cliente final",
            "Soporte a UTM governance (detectar UTM rotas / duplicadas)",
            "Simulador de presupuesto: “si mueves $X aquí, hot leads estimados”",
            "Conector TikTok Ads (read) como tercera fuente",
            "Playbooks de remediación por vertical (checklist accionable)",
        ],
    },
    {
        "name": "Helix for Legal",
        "pitch": (
            "Partner Go/No-Go con cites. Vende no bidear basura y no chocar COI — "
            "no “AI summary”."
        ),
        "today": "RFP ingest PDF/DOCX, partner verdict, deadlines, pricing memory",
        "gap": "Corpus real, win-rate, write-back externo a DMS/CLM",
        "north": "Horas partner ahorradas + % NO-GO correctos + cite accuracy",
        "market": [
            "Win-rate dashboard: GO/CONDITIONAL/NO-GO → won/lost + $ pipeline",
            "Firm book editable (rates, matter types, no-bid rules) versionado",
            "COI checks contra matters reales (no solo heurística local)",
            "Deadline pack: calendar OAuth + alerts 7/3/1 con escalation",
            "Proposal / Word export listo para partner",
            "Corpus de la firma con cites reales (RAG + pgvector, no mock)",
        ],
        "robust": [
            "Eliminar corpusStatus mocked o marcar UI “unavailable” hasta live",
            "DMS connectors (iManage / NetDocuments / SharePoint)",
            "Matter / CLM light write-back (Clio, PracticePanther o custom)",
            "Comms log + privilege flags en cada decisión",
            "Multi-office workspaces con conflict walls",
            "Immutable audit + retention policies",
            "RFP intake portal para clientes (sin darles el desk completo)",
            "Model eval harness: cite accuracy % tracked over time",
        ],
        "extra10": [
            "Checklist de red flags por practice area (auto-sugerida)",
            "Comparador de RFPs similares (precedentes internos)",
            "Pricing suggestion engine con historial de deals cerrados",
            "Staffing hint: socios/asociados sugeridos por expertise",
            "Export de decision memo (1–2 páginas) con cites ancladas",
            "Integración Outlook para deadlines y follow-ups",
            "Modo “second partner review” para bids &gt; umbral $",
            "Taxonomía de razones NO-GO (analytics de rechazo)",
            "Sandbox de prompts legales versionados por firma",
            "Certificación de fuentes: cada cite con page/span verificable",
        ],
    },
    {
        "name": "Helix for Inbox",
        "pitch": (
            "Triage + HITL + send. El mercado compra tiempo y “nada sale sin humano”; "
            "hoy el mail es frágil."
        ),
        "today": "Paste ingest, Gmail token sync, Resend send, HITL queue",
        "gap": "OAuth estable, reply-in-thread, multi-canal",
        "north": "Median time-to-first-human-reply y % drafts enviados sin editar",
        "market": [
            "Gmail / Workspace OAuth app + refresh tokens (install 1-click)",
            "Reply-in-thread vía Gmail API (no Resend paralelo al mailbox)",
            "SLA time-to-reply por categoría / VIP",
            "Handoff a Slack + Helix Leads (lead detectado → desk)",
            "Shared mailbox / alias support (ops@, support@)",
            "Weekly “hours saved” report para EA / founder",
        ],
        "robust": [
            "Microsoft 365 / Outlook parity",
            "Assignment + presence (quién tiene el thread)",
            "Snooze / follow-up reminders que sobreviven refresh",
            "VIP + blocklists sync desde contacts CRM",
            "Attachment / phishing heuristics + quarantine",
            "Audit de envíos (quién aprobó el draft)",
            "Multi-mailbox tenants con RLS",
            "Smart-reply con Claude + style guide por workspace",
        ],
        "extra10": [
            "Detección de urgencia + intent (billing, sales, support, spam)",
            "Plantillas aprobadas por categoría con variables",
            "Escalation ladder (ops → manager → founder) por SLA breach",
            "Digest matutino: “12 pendientes, 3 VIP, 1 SLA en riesgo”",
            "Modo vacation / out-of-office consciente del desk",
            "Búsqueda full-text + filtros guardados por operador",
            "Thread merge / split para conversaciones mezcladas",
            "Política de retención y borrado automático de spam",
            "Webhook inbound desde formularios web → cola HITL",
            "KPI de “first draft acceptance rate” por operador",
        ],
    },
    {
        "name": "Helix for Commerce",
        "pitch": (
            "Fraud + fulfill HITL sobre Shopify. Vende $ at risk / $ saved, "
            "no otro admin de tienda."
        ),
        "today": "Shopify sync, fraud review, fulfill/cancel live",
        "gap": "Webhooks vivos, métrica $ saved, inventory write-back",
        "north": "$ fraud blocked / mes y fulfill SLA (time-to-ship post-approve)",
        "market": [
            "Métrica hero: $ at risk blocked + $ saved vs chargebacks",
            "Shopify webhooks (orders/create, fulfillments, refunds) en vivo",
            "Fraud signals nativos Shopify + Helix score unificado",
            "Inventory reorder write-back (draft PO / low-stock action)",
            "Returns / RMA desk ligero (approve refund / restock)",
            "Daily ops brief: “3 órdenes high-risk, $X hold”",
        ],
        "robust": [
            "Multi-store / multi-currency",
            "Webhook signature verify + idempotency + replay",
            "Chargeback evidence pack export",
            "Customer risk graph (repeat fraud rings)",
            "Catalog CSV import completo + bulk review",
            "Inquiry → quote → order path con HITL",
            "Guardrails: cancel/fulfill siempre operator-gated + audit",
            "Health: last webhook, API rate limits, sync lag",
        ],
        "extra10": [
            "Hold automático de fulfillment si score &gt; umbral (con override HITL)",
            "Detección de address mismatch / velocity / gift-card abuse",
            "Cola de “manual capture” para pagos en riesgo",
            "Alertas de stockout predicho por SKU (7/14 días)",
            "Bundle / kit inventory awareness en reorder",
            "Integración 3PL / shipping labels post-approve",
            "Customer notes sync a Shopify (decisión Helix visible en admin)",
            "Modo Black Friday: umbrales y staffing de cola adaptativos",
            "Replay tool para re-procesar webhooks fallidos",
            "Dashboard de “false positive rate” del fraud model",
        ],
    },
]

FAMILY = {
    "market": [
        "Control plane único (workspaces + SSO)",
        "Roles: owner / operator / viewer",
        "Audit export (CSV/PDF) cross-desk",
        "Billing + usage metering",
        "White-label agencia (logo, dominio)",
        "Cross-desk events (Lead won → Marketing ROI)",
    ],
    "robust": [
        "Tenancy real (Supabase org / RLS)",
        "OAuth apps (no paste de tokens)",
        "Webhooks inbound + retry + DLQ",
        "Notificaciones (email + Slack + in-app)",
        "SLA / assignment / handoff multi-usuario",
        "Retention + PII redaction",
        "Health dashboard de conectores",
        "Playbooks + empty states + demo → live",
    ],
    "extra10": [
        "Status page pública por cliente (uptime de desks)",
        "Feature flags por workspace / plan",
        "Impersonation auditada para soporte",
        "Data residency opción (US / EU)",
        "SOC2-ready logging (quién, qué, cuándo, por qué)",
        "SDK / CLI para operadores y partners",
        "Marketplace de “score packs” y playbooks verticales",
        "Unified search cross-desk (lead, RFP, order, thread)",
        "Onboarding checklist compartida familia",
        "Contrato de SLA comercial + créditos por downtime",
    ],
}


def build():
    story = []

    story.append(Spacer(1, 1.2 * inch))
    story.append(
        Paragraph(
            "HELIX",
            ParagraphStyle(
                "Brand",
                fontName="Helvetica-Bold",
                fontSize=12,
                textColor=ACCENT,
                spaceAfter=10,
            ),
        )
    )
    story.append(Paragraph("Roadmap de mejoras por producto", styles["CoverTitle"]))
    story.append(
        Paragraph(
            "Lista consolidada: valor de mercado + robustez operativa + 10 extras por Helix "
            "(Leads, Marketing, Legal, Inbox, Commerce) y capa de familia.",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 0.25 * inch))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceBefore=0, spaceAfter=14))

    meta_data = [
        [
            Paragraph("<b>Audiencia</b>", styles["MetaDoc"]),
            Paragraph("Producto / ops / founders Helix", styles["MetaDoc"]),
        ],
        [
            Paragraph("<b>Criterio</b>", styles["MetaDoc"]),
            Paragraph(
                "Dinero recuperado, riesgo reducido u horas de operador — no polish cosmético",
                styles["MetaDoc"],
            ),
        ],
        [
            Paragraph("<b>Barra de producto</b>", styles["MetaDoc"]),
            Paragraph(
                "Inbound vivo → evidencia + HITL → write-back → métrica → audit → roles",
                styles["MetaDoc"],
            ),
        ],
        [
            Paragraph("<b>Fecha</b>", styles["MetaDoc"]),
            Paragraph("Septiembre 2026", styles["MetaDoc"]),
        ],
    ]
    mt = Table(meta_data, colWidths=[1.4 * inch, 5.3 * inch])
    mt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(mt)
    story.append(Spacer(1, 0.4 * inch))
    story.append(
        Paragraph(
            "<b>Orden de inversión sugerido:</b> 1) Leads closed-loop ROI · "
            "2) Marketing Ads read + $ on spam · 3) Familia auth/roles · "
            "4) Legal corpus + win-rate · 5) Inbox OAuth + thread · "
            "6) Commerce webhooks + $ saved",
            styles["BodyDoc"],
        )
    )
    story.append(PageBreak())

    story.append(Paragraph("Contenido", styles["H1Doc"]))
    story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=2, spaceAfter=12))
    for t in [
        "1. Capa de familia (plataforma)",
        "2. Helix for Leads",
        "3. Helix for Marketing",
        "4. Helix for Legal",
        "5. Helix for Inbox",
        "6. Helix for Commerce",
        "7. Resumen de prioridades",
    ]:
        story.append(Paragraph(t, styles["TOCItem"]))
    story.append(PageBreak())

    story.extend(
        section_header(
            "1. Capa de familia",
            "Sin esto cada Helix es una app suelta. Con esto es plataforma revendible.",
        )
    )
    story.append(Paragraph("A · Valor de mercado", styles["H3Doc"]))
    story.extend(bullet_block(FAMILY["market"]))
    story.append(Paragraph("B · Robustez de producto", styles["H3Doc"]))
    story.extend(bullet_block(FAMILY["robust"]))
    story.append(Paragraph("C · 10 extras adicionales", styles["H3Doc"]))
    story.extend(bullet_block(FAMILY["extra10"]))
    story.append(PageBreak())

    for idx, p in enumerate(PRODUCTS, start=2):
        story.extend(section_header(f"{idx}. {p['name']}", p["pitch"]))

        info = [
            [Paragraph("<b>Hoy</b>", styles["MetaDoc"]), Paragraph(p["today"], styles["MetaDoc"])],
            [Paragraph("<b>Falta</b>", styles["MetaDoc"]), Paragraph(p["gap"], styles["MetaDoc"])],
            [Paragraph("<b>North star</b>", styles["MetaDoc"]), Paragraph(p["north"], styles["MetaDoc"])],
        ]
        it = Table(info, colWidths=[1.1 * inch, 5.6 * inch])
        it.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                    ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(it)

        story.append(Paragraph("A · Valor de mercado (sube el precio)", styles["H3Doc"]))
        story.extend(bullet_block(p["market"]))
        story.append(Paragraph("B · Robustez (deja de ser app simple)", styles["H3Doc"]))
        story.extend(bullet_block(p["robust"]))
        story.append(Paragraph("C · 10 extras adicionales", styles["H3Doc"]))
        story.extend(bullet_block(p["extra10"]))

        if idx < 6:
            story.append(PageBreak())

    story.append(PageBreak())
    story.extend(
        section_header(
            "7. Resumen de prioridades",
            "Qué mover primero si el objetivo es producto robusto + ticket más alto.",
        )
    )

    rows = [
        [
            Paragraph("<b>Prioridad</b>", styles["MetaDoc"]),
            Paragraph("<b>Desk</b>", styles["MetaDoc"]),
            Paragraph("<b>Slice</b>", styles["MetaDoc"]),
            Paragraph("<b>Por qué</b>", styles["MetaDoc"]),
        ],
        [
            Paragraph("P0", styles["ItemDoc"]),
            Paragraph("Leads", styles["ItemDoc"]),
            Paragraph("Closed-loop ROI", styles["ItemDoc"]),
            Paragraph("Historia de venta más clara", styles["ItemDoc"]),
        ],
        [
            Paragraph("P0", styles["ItemDoc"]),
            Paragraph("Marketing", styles["ItemDoc"]),
            Paragraph("Ads read + $ on spam", styles["ItemDoc"]),
            Paragraph("Dolor diario de agencias", styles["ItemDoc"]),
        ],
        [
            Paragraph("P0", styles["ItemDoc"]),
            Paragraph("Familia", styles["ItemDoc"]),
            Paragraph("Auth / roles / audit", styles["ItemDoc"]),
            Paragraph("Base para vender SaaS", styles["ItemDoc"]),
        ],
        [
            Paragraph("P1", styles["ItemDoc"]),
            Paragraph("Legal", styles["ItemDoc"]),
            Paragraph("Corpus + win-rate", styles["ItemDoc"]),
            Paragraph("Trust + precio mid-market", styles["ItemDoc"]),
        ],
        [
            Paragraph("P1", styles["ItemDoc"]),
            Paragraph("Inbox", styles["ItemDoc"]),
            Paragraph("OAuth + reply-in-thread", styles["ItemDoc"]),
            Paragraph("Sin esto no hay producto mail", styles["ItemDoc"]),
        ],
        [
            Paragraph("P1", styles["ItemDoc"]),
            Paragraph("Commerce", styles["ItemDoc"]),
            Paragraph("Webhooks + $ saved", styles["ItemDoc"]),
            Paragraph("Ops real, no sync manual", styles["ItemDoc"]),
        ],
    ]
    rt = Table(rows, colWidths=[0.7 * inch, 1.1 * inch, 2.0 * inch, 2.9 * inch])
    rt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SOFT]),
            ]
        )
    )
    story.append(rt)
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            "Regla: cada mejora debe mover <b>dinero recuperado</b>, <b>horas de ops</b> o "
            "<b>riesgo</b>. Si no, es polish y va al final.",
            styles["BodyDoc"],
        )
    )

    family_n = len(FAMILY["market"]) + len(FAMILY["robust"]) + len(FAMILY["extra10"])
    per_desk = 6 + 8 + 10
    total = family_n + 5 * per_desk
    story.append(Spacer(1, 0.15 * inch))
    story.append(
        Paragraph(
            f"Total ítems en este documento: {total} mejoras "
            f"(familia {family_n} + 5 desks × {per_desk}).",
            styles["MetaDoc"],
        )
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.75 * inch,
        title="Helix — Roadmap de mejoras por producto",
        author="Helix Product",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT}")
    print(f"Size bytes: {OUT.stat().st_size}")


if __name__ == "__main__":
    build()
