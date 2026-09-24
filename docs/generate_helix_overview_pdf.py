"""Generate Helix family product overview PDF (ES)."""
from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent / "helix-productos-overview.pdf"

INK = HexColor("#0F172A")
MUTED = HexColor("#475569")
ACCENT = HexColor("#0EA5E9")
LINE = HexColor("#E2E8F0")
SOFT = HexColor("#F8FAFC")
DARK = HexColor("#0F172A")

styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        name="CoverTitle",
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
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
        leading=15,
        textColor=MUTED,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="H1Doc",
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=INK,
        spaceBefore=2,
        spaceAfter=6,
    )
)
styles.add(
    ParagraphStyle(
        name="H2Doc",
        fontName="Helvetica-Bold",
        fontSize=11,
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
        spaceAfter=5,
        alignment=TA_JUSTIFY,
    )
)
styles.add(
    ParagraphStyle(
        name="ItemDoc",
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=INK,
        leftIndent=2,
        spaceAfter=2,
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
        spaceAfter=3,
    )
)
styles.add(
    ParagraphStyle(
        name="Problem",
        fontName="Helvetica-Oblique",
        fontSize=9.5,
        leading=13,
        textColor=INK,
        spaceAfter=6,
        alignment=TA_JUSTIFY,
    )
)


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(0.75 * inch, 0.55 * inch, letter[0] - 0.75 * inch, 0.55 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(0.75 * inch, 0.35 * inch, "Helix · Overview de productos · Confidencial")
    canvas.drawRightString(letter[0] - 0.75 * inch, 0.35 * inch, str(doc.page))
    canvas.restoreState()


def hr():
    return HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=2, spaceAfter=8)


def bullets(items):
    return [Paragraph(f"•  {t}", styles["ItemDoc"]) for t in items]


def info_table(rows):
    data = [
        [Paragraph(f"<b>{k}</b>", styles["MetaDoc"]), Paragraph(v, styles["MetaDoc"])]
        for k, v in rows
    ]
    t = Table(data, colWidths=[1.35 * inch, 5.35 * inch])
    t.setStyle(
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
    return t


PRODUCTS = [
    {
        "num": "1",
        "name": "Helix for Leads",
        "tagline": "Desk de scoring de leads + revisión humana + push al CRM.",
        "problem": (
            "Las agencias y negocios de servicios reciben cientos de leads de ads/forms "
            "y no saben cuáles valen la pena. Pierden tiempo en spam, tardan en contactar "
            "a los buenos y no pueden demostrar ROI al cliente."
        ),
        "does": (
            "Ingesta leads (webhook GHL / API), los clasifica y puntúa con evidencia, "
            "manda los dudosos a una cola HITL y, al aprobar, escribe en el CRM (GoHighLevel). "
            "Opcional: Slack, outreach drafts, lookalikes y meeting slots."
        ),
        "sectors": (
            "Agencias de marketing / performance · Home services (HVAC, dental, plumbing) · "
            "Clínicas y servicios locales con lead gen · Equipos de ventas inbound"
        ),
        "who": "Media buyers, closers, ops de agencia, dueños de negocio con formularios de ads.",
        "features": [
            "Ingest + webhook GoHighLevel con atribución de campaña",
            "Scoring / clasificación (lead, spam, inquiry) con confianza",
            "Cola HITL: approve / revise / archive antes de CRM",
            "Write-back a GHL (contacto) — falla claro si no hay keys",
            "Dashboard + analytics por fuente / hot %",
            "Audit de decisiones IA + overrides humanos",
            "Settings: scoring, prompts, automations, brand, integrations",
            "Operator key para acciones sensibles",
        ],
        "solves": [
            "Dejar de tratar todos los leads igual",
            "Reducir tiempo a first-touch en leads calientes",
            "Evitar que la IA escriba sola en el CRM",
            "Dar evidencia al cliente de por qué un lead es hot o basura",
        ],
    },
    {
        "num": "2",
        "name": "Helix for Marketing",
        "tagline": "Une gasto de ads con calidad de leads para pausar o escalar con evidencia.",
        "problem": (
            "Ads Manager muestra CPL barato, pero muchos leads son basura. El media buyer "
            "escala volumen y quema presupuesto sin ver score real. El CSV manual es lento "
            "y las campañas “baratas” pueden ser las peores."
        ),
        "does": (
            "Importa spend (CSV hoy; Ads API en roadmap), sincroniza leads scorados desde "
            "Helix Leads, hace join por campaign_id y recomienda pause / scale / keep. "
            "Las acciones pasan por HITL; cola unmatched para remapear spend sin lead."
        ),
        "sectors": (
            "Agencias de paid media · In-house growth / performance · "
            "Cualquier negocio que pague Meta/Google lead ads y mida calidad"
        ),
        "who": "Media buyers, performance managers, account managers de agencia.",
        "features": [
            "Performance Engine: spend, volume, score, cost-per-hot, REC",
            "Ventanas 7d / 30d / 90d",
            "Sync de leads scorados desde Helix for Leads",
            "Join / remap de campañas unmatched",
            "HITL review: pause / scale / keep (local; Ads write-back en roadmap)",
            "Ingest CSV de spend con campaign_id",
            "Help + Settings con keys (Meta/Google stubs → OAuth real en roadmap)",
        ],
        "solves": [
            "Dejar de optimizar solo por CPL",
            "Ver “$ gastado en leads malos” vs hot leads",
            "Decidir pause/scale con calidad, no solo volumen",
            "Cerrar el loop ads ↔ scoring sin Excel eterno",
        ],
    },
    {
        "num": "3",
        "name": "Helix for Legal",
        "tagline": "Partner Go / No-Go en RFPs con cites, COI y memoria de pricing.",
        "problem": (
            "Las firmas mid-market pierden horas de partner leyendo RFPs que al final no "
            "van a bidear, o bidean y chocan conflictos de interés. No hay memoria clara "
            "de precios ni de por qué se dijo no."
        ),
        "does": (
            "Ingesta RFP (paste / PDF / DOCX), extrae señales, propone GO / CONDITIONAL / "
            "NO-GO con cites (FACT), chequea COI, guarda pricing memory y deadlines. "
            "El partner confirma o override; todo queda en audit."
        ),
        "sectors": (
            "Firmas de abogados mid-market · BD / proposal teams · "
            "Legal ops · Practice groups que responden RFPs / pitches"
        ),
        "who": "Partners, business development, conflicts counsel, legal ops.",
        "features": [
            "Ingest RFP + extract PDF/DOCX",
            "Veredicto partner GO / CONDITIONAL / NO-GO con HITL",
            "Conflict of interest (COI) flags",
            "Cites ancladas al texto (FACT)",
            "Deadlines + alerts (7/3/1)",
            "Pricing memory / fee posture",
            "Documents, analytics, notifications, audit",
            "Intelligence / corpus (roadmap: RAG real de la firma)",
            "Workspaces + operator unlock",
        ],
        "solves": [
            "No gastar partner time en RFPs que debían ser NO-GO",
            "Reducir riesgo de COI antes de comprometer",
            "Dejar rastro auditable de la decisión",
            "Reusar pricing y criterios de la firma",
        ],
    },
    {
        "num": "4",
        "name": "Helix for Inbox",
        "tagline": "Triage de email + draft + humano antes de enviar o rutar.",
        "problem": (
            "Founders, EAs y ops se ahogan en bandeja: spam, VIP, ventas y soporte mezclados. "
            "Los bots que envían solos generan riesgo. Responder tarde a lo importante "
            "cuesta deals y reputación."
        ),
        "does": (
            "Ingesta mensajes (paste / sync Gmail), clasifica, propone ruta y draft, "
            "y solo envía o rutea tras HITL. Resend para envío; VIP / blocklists y "
            "preferencias de tono en Settings."
        ),
        "sectors": (
            "Executive assistants · Founders / small ops teams · "
            "Customer ops ligeros · Cualquier mailbox compartido de alto volumen"
        ),
        "who": "EA, founder, office manager, ops de soporte ligero.",
        "features": [
            "Dashboard: open, need-review, urgent, blocked",
            "HITL queue: approve / route / snooze / block",
            "Drafts de reply con tono configurable",
            "Sync Gmail (token; OAuth app en roadmap)",
            "Envío vía Resend (409 claro sin keys)",
            "Vistas Routed / Blocked + analytics",
            "VIP senders + preferencias",
            "Audit de acciones",
        ],
        "solves": [
            "Priorizar lo urgente/VIP sin leer todo",
            "Nada sale sin humano (compliance / brand)",
            "Reducir tiempo a first reply",
            "Separar spam/ruta de conversaciones reales",
        ],
    },
    {
        "num": "5",
        "name": "Helix for Commerce",
        "tagline": "Fraud + fulfill HITL sobre Shopify: riesgo en $ antes de ship.",
        "problem": (
            "Las tiendas Shopify pierden dinero en fraude/chargebacks o frenan pedidos "
            "buenos. El admin nativo no es un desk de decisión con evidencia. "
            "Restock y fulfill se hacen a ciegas o demasiado tarde."
        ),
        "does": (
            "Sincroniza órdenes Shopify, puntúa fraude, pone high-risk en HITL y al "
            "aprobar cumple o cancela en Shopify (live). Señales de inventory/restock, "
            "catálogo, customers y analytics de revenue/riesgo."
        ),
        "sectors": (
            "E-commerce DTC en Shopify · Ops / fulfillment teams · "
            "Fraud & risk mid-market · Marcas con alto ticket o gift-card risk"
        ),
        "who": "Ops de e-commerce, fraud analysts, inventory managers, store owners.",
        "features": [
            "Sync Shopify Admin (órdenes / catálogo)",
            "Fraud score 0–100 + cola HITL",
            "Fulfill / cancel write-back real (con keys)",
            "Inventory / restock recommendations",
            "Products, customers, analytics",
            "Inquiry path + catalog review",
            "Operator gate + audit",
            "Roadmap: webhooks vivos, $ saved, RMA",
        ],
        "solves": [
            "Bloquear $ en riesgo antes de ship",
            "No cancelar/fulfill a ciegas",
            "Anticipar stockouts",
            "Dejar trail de quién aprobó qué orden",
        ],
    },
]


def build():
    story = []

    # Cover
    story.append(Spacer(1, 0.9 * inch))
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
    story.append(Paragraph("Qué hace cada producto", styles["CoverTitle"]))
    story.append(
        Paragraph(
            "Overview de la familia Helix: qué es cada desk, a qué sector beneficia, "
            "funciones principales y qué problema resuelve.",
            styles["CoverSub"],
        )
    )
    story.append(Spacer(1, 0.2 * inch))
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT, spaceBefore=0, spaceAfter=14))

    meta = info_table(
        [
            ("Familia", "5 desks verticales + capa compartida (@helix/core, HITL, operator)"),
            ("Modelo", "Evidencia → humano → write-back al sistema de verdad"),
            ("No es", "Chatbot genérico ni otro CRM/Ads Manager clon"),
            ("Fecha", "Septiembre 2026"),
        ]
    )
    story.append(meta)
    story.append(Spacer(1, 0.3 * inch))
    story.append(Paragraph("Tesis de producto", styles["H2Doc"]))
    story.append(
        Paragraph(
            "Helix vende <b>desks de decisión</b>: la IA propone con evidencia; un humano "
            "aprueba; la acción escribe en GHL, Ads, Gmail/Resend, Shopify o queda "
            "auditada en Legal. El valor es dinero recuperado, riesgo reducido u horas de ops.",
            styles["BodyDoc"],
        )
    )
    story.append(PageBreak())

    # TOC + family matrix
    story.append(Paragraph("Contenido", styles["H1Doc"]))
    story.append(hr())
    for line in [
        "0. Cómo funciona la familia",
        "1. Helix for Leads",
        "2. Helix for Marketing",
        "3. Helix for Legal",
        "4. Helix for Inbox",
        "5. Helix for Commerce",
        "6. Mapa sector → producto",
    ]:
        story.append(Paragraph(line, styles["TOCItem"]))
    story.append(PageBreak())

    story.append(Paragraph("0. Cómo funciona la familia", styles["H1Doc"]))
    story.append(hr())
    story.append(
        Paragraph(
            "Los cinco Helix comparten el mismo patrón de producto:",
            styles["BodyDoc"],
        )
    )
    story.extend(
        bullets(
            [
                "Inbound vivo (webhook, sync, CSV, paste, PDF)",
                "Score / clasificación con evidencia y confianza",
                "Cola HITL cuando la confianza es baja o la acción es irreversible",
                "Write-back al sistema de verdad (o error ruidoso si faltan keys)",
                "Audit: quién aprobó qué y cuándo",
                "Desk vacío por defecto; demo opcional; operator key para writes",
            ]
        )
    )
    story.append(Spacer(1, 0.12 * inch))
    story.append(Paragraph("Mapa rápido", styles["H2Doc"]))

    quick = [
        [
            Paragraph("<b>Helix</b>", styles["MetaDoc"]),
            Paragraph("<b>Problema en 1 línea</b>", styles["MetaDoc"]),
            Paragraph("<b>Sector principal</b>", styles["MetaDoc"]),
        ],
        [
            Paragraph("Leads", styles["ItemDoc"]),
            Paragraph("Leads basura vs hot sin priorizar", styles["ItemDoc"]),
            Paragraph("Agencias + home services", styles["ItemDoc"]),
        ],
        [
            Paragraph("Marketing", styles["ItemDoc"]),
            Paragraph("Ads baratos que traen spam", styles["ItemDoc"]),
            Paragraph("Paid media / growth", styles["ItemDoc"]),
        ],
        [
            Paragraph("Legal", styles["ItemDoc"]),
            Paragraph("RFP que no debían bidearse", styles["ItemDoc"]),
            Paragraph("Firmas mid-market", styles["ItemDoc"]),
        ],
        [
            Paragraph("Inbox", styles["ItemDoc"]),
            Paragraph("Bandeja caótica; bots inseguros", styles["ItemDoc"]),
            Paragraph("EA / founders / ops", styles["ItemDoc"]),
        ],
        [
            Paragraph("Commerce", styles["ItemDoc"]),
            Paragraph("Fraude y fulfill a ciegas", styles["ItemDoc"]),
            Paragraph("Shopify DTC / ops", styles["ItemDoc"]),
        ],
    ]
    qt = Table(quick, colWidths=[1.1 * inch, 2.8 * inch, 2.8 * inch])
    qt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SOFT]),
            ]
        )
    )
    story.append(qt)
    story.append(PageBreak())

    # Products
    for p in PRODUCTS:
        block = []
        block.append(Paragraph(f"{p['num']}. {p['name']}", styles["H1Doc"]))
        block.append(hr())
        block.append(Paragraph(p["tagline"], styles["MetaDoc"]))
        block.append(Spacer(1, 0.06 * inch))

        block.append(Paragraph("Problema que resuelve", styles["H2Doc"]))
        block.append(Paragraph(p["problem"], styles["Problem"]))

        block.append(Paragraph("Qué hace", styles["H2Doc"]))
        block.append(Paragraph(p["does"], styles["BodyDoc"]))

        block.append(info_table([("Sector", p["sectors"]), ("Usuarios", p["who"])]))

        block.append(Paragraph("Funciones principales", styles["H2Doc"]))
        block.extend(bullets(p["features"]))

        block.append(Paragraph("Resultados / alivio", styles["H2Doc"]))
        block.extend(bullets(p["solves"]))

        story.append(KeepTogether(block))
        if p["num"] != "5":
            story.append(PageBreak())

    # Sector map
    story.append(PageBreak())
    story.append(Paragraph("6. Mapa sector → producto", styles["H1Doc"]))
    story.append(hr())
    story.append(
        Paragraph(
            "Si vendes o priorizas por vertical, usa esta guía rápida:",
            styles["BodyDoc"],
        )
    )

    sector_rows = [
        [
            Paragraph("<b>Si el cliente es…</b>", styles["MetaDoc"]),
            Paragraph("<b>Empieza con</b>", styles["MetaDoc"]),
            Paragraph("<b>Combina con</b>", styles["MetaDoc"]),
        ],
        [
            Paragraph("Agencia HVAC / dental / local services", styles["ItemDoc"]),
            Paragraph("Leads", styles["ItemDoc"]),
            Paragraph("Marketing (calidad de ads)", styles["ItemDoc"]),
        ],
        [
            Paragraph("Performance / media buying shop", styles["ItemDoc"]),
            Paragraph("Marketing", styles["ItemDoc"]),
            Paragraph("Leads (score real)", styles["ItemDoc"]),
        ],
        [
            Paragraph("Firma de abogados mid-market", styles["ItemDoc"]),
            Paragraph("Legal", styles["ItemDoc"]),
            Paragraph("Inbox (BD / partner mail)", styles["ItemDoc"]),
        ],
        [
            Paragraph("Founder / EA con bandeja loca", styles["ItemDoc"]),
            Paragraph("Inbox", styles["ItemDoc"]),
            Paragraph("Leads (si hay inbound sales)", styles["ItemDoc"]),
        ],
        [
            Paragraph("Marca DTC en Shopify", styles["ItemDoc"]),
            Paragraph("Commerce", styles["ItemDoc"]),
            Paragraph("Inbox (CS) o Marketing (ads)", styles["ItemDoc"]),
        ],
    ]
    st = Table(sector_rows, colWidths=[2.6 * inch, 1.5 * inch, 2.6 * inch])
    st.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), DARK),
                ("TEXTCOLOR", (0, 0), (-1, 0), white),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, SOFT]),
            ]
        )
    )
    story.append(st)
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            "Regla de oro: Helix no reemplaza GHL, Ads Manager, Clio, Gmail o Shopify. "
            "Se sienta encima como <b>desk de decisión</b> con humano en el loop.",
            styles["BodyDoc"],
        )
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.75 * inch,
        title="Helix — Qué hace cada producto",
        author="Helix Product",
    )
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT} ({OUT.stat().st_size} bytes)")


if __name__ == "__main__":
    build()
