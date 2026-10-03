# Helix: qué tenemos hoy en cada producto

**Fecha:** 30 sep 2026 · **Rama:** `feature/lead-scoring-template` · **Estado del repo:** todo lo de las 5 apps está commiteado y subido (commits `7069a02` y `cff4484`). **Helix for Real Estate está solo en local, sin commitear ni desplegar.**

---

## 1. Resumen de un vistazo

| Helix | Producción | Puerto local | Demo al abrir | Ask AI ejecuta acciones | Tests |
|---|---|---|---|---|---|
| Leads | https://helix-for-leads.vercel.app | 43148 | Sí, sin login | Sí | 33 |
| Legal | https://helix-for-legal.vercel.app | 43149 | Sí | Sí | 16 |
| Commerce | https://helix-for-commerce.vercel.app | 43150 | Sí | Sí | 16 |
| Inbox | https://helix-for-inbox.vercel.app | 43151 | Sí | Sí | 11 |
| Marketing | https://helix-for-marketing.vercel.app | 43152 | Sí | Sí | 8 |
| Real Estate | solo local | 43153 | Sí | No (solo lectura, Fase 0) | 18 |
| `helix-core` (compartido) | n/a | n/a | n/a | n/a | 160 |

Verificado: las 5 URLs de producción responden 200. En Leads, Inbox, Legal y Marketing comprobé además que `/api/settings/desk` devuelve `mode: demo`. En Commerce no verifiqué ese estado en producción.

---

## 2. Lo que comparten todos (paquete `helix-core`)

- **Modo demo / live (una sola regla):** si no hay nada conectado y no hay datos reales, el desk muestra datos de muestra. En cuanto se conecta la integración o hay datos reales, pasan a verse solo los reales. Nunca se mezclan.
  - Variable `HELIX_DESK_SEED`: sin definir = demo permitida. `off` o `empty` = el desk arranca vacío (para un cliente real).
- **Los datos de demo nunca se guardan en Supabase.** Mientras hay demo, la capa de Supabase queda suspendida (ni lee ni escribe). En Leads, un visitante sin login solo recibe un sandbox en memoria, nunca datos de otro cliente.
- **Motor de acciones de IA (genérico):** cada app registra sus acciones y el motor aporta:
  - **Política de riesgo determinística** en código. La IA no decide sus propios permisos.
    - `auto`: se ejecuta al instante y deja un botón **Undo**.
    - `confirm`: se detiene y pide tu OK, explicando por qué.
  - Ejecución por objetivo, con cada fallo visible (nada se traga en silencio).
  - Undo con datos de restauración que se validan.
- **Agente con herramientas (Claude tool-use):** bucle `runAgent` / `resumeAgent` y adaptador de Anthropic. **Escrito y con test de formato, pero ninguna app lo usa todavía y nunca lo probé contra la API real.** El modelo por defecto `claude-sonnet-5-5` es un supuesto mío.
- **Panel Ask Helix AI (misma plantilla en las 5 apps):** panel lateral con historial de conversaciones, adjuntar imagen, tarjetas de "Hecho automáticamente + Undo" y "Necesita tu OK + Confirm/Dismiss", botón **Watch Helix work** (demo guionizada) y **Reset**. El tema cambia por app.
- **Sin `ANTHROPIC_API_KEY`:**
  - En demo, responde un asistente determinístico con los datos reales del desk. No adjunta imágenes.
  - Fuera de demo, "Limited Mode": devuelve el contexto del desk en crudo. Con la clave, responde Claude.
- **Reacción en vivo del dashboard:** al actuar la IA, toast + parpadeo de la fila + refresco de datos.
- **How-to-use** de las 5 apps actualizado con el paso "Ask Helix AI".

---

## 3. Helix for Leads

**Qué es:** inteligencia de leads entrantes. Clasifica (lead/spam/info), puntúa 0–100, mantiene lo dudoso en revisión humana y sincroniza con GoHighLevel.

**Páginas:** Dashboard (Autonomous Triage Overview), Leads, Triage Inbox, Analytics & Telemetry, Scoring Rules, Prompt Studio, Integrations & Sync, Automations & Workflows, Desk Settings, Audit Log & Security, API & Webhooks, How to use.

**Demo:** 6 leads sembrados (Maya Chen, Luis Ortega, Ava Brooks, Crypto Blast, Priya Nair, Jordan Hale). Banner "Demo data" con **Reset demo** y **Connect →**. Pasa a live al conectar GoHighLevel (API key + location).

**Ask AI, qué hace:**
- Preguntas: resumen del pipeline, por qué un lead tiene su score (con citas), cola de revisión, leads viejos, mejor siguiente movimiento.
- Órdenes: "Move Jordan Hale to contacted", "Clean up my stale leads", "Add a note to Maya Chen: …".

| Acción | Regla |
|---|---|
| Mover a Contacted, agregar nota | Automática, con Undo |
| Archivar 1 lead frío y viejo | Automática, con Undo |
| Archivar con score ≥70, más de 3, ya en CRM o pendiente de revisión | Pide confirmación |
| Aprobar la cola de revisión | Siempre pide confirmación |
| Mover un lead aún en revisión | Pide confirmación |

**Seguridad:** el push al CRM sigue exigiendo la clave de operador y no está disponible para invitados. Todo cambio de la IA queda firmado como "Helix AI · approved by …" en Audit.

**Pendiente / límites:** el demo en producción vive en memoria del servidor y se comparte entre visitantes hasta que alguien pulse Reset. Detecté (sin tocarlo) que `getLead` leía del caché sin comprobar la organización: conviene revisarlo aparte.

---

## 4. Helix for Legal

**Qué es:** inteligencia de RFPs para firmas de abogados: extrae campos con citas, empareja con el perfil de la firma, Go/No-Go, conflictos (COI), precios.

**Páginas:** Dashboard, Opportunities, Documents, Deadlines, Pricing, Outcomes, Analytics, Settings, Audit Log, How to use. Rediseño Material 3 con acento plata.

**Demo:** 4 RFPs de muestra. No hay API externa que conectar: pasa a live cuando Supabase ya tiene RFPs reales, o cuando eliges "usar mis propios datos".

**Ask AI, qué hace:** qué requiere atención, deadlines, resumen, explicar un RFP, y estas acciones:

| Acción | Regla |
|---|---|
| Enviar un RFP a revisión del socio, agregar nota | Automática, con Undo (pide confirmación si ya tiene decisión de socio o son más de 3) |
| Correr chequeo de conflictos, preparar cotización | Automática (solo calcula, no tiene Undo) |
| Registrar GO / CONDITIONAL / NO-GO | **Siempre confirmación**: es decisión del socio |

**Nota:** una versión anterior dejó 4 filas de demo guardadas en tu Supabase. El commit `cff4484` (de otra sesión) hace que no cuenten como datos reales. Tras el despliegue, producción ya muestra `mode: demo`.

---

## 5. Helix for Commerce

**Qué es:** operaciones de e-commerce / Shopify: puntuación de fraude, alertas de inventario, aprobación humana antes de cumplir.

**Páginas:** Dashboard, Orders, $ at risk, Products, Inventory, Returns/RMA, Customers, Analytics, Settings, How to use.

**Demo:** pedidos y productos de la tienda mock (el pedido #1003 y #1005 son de riesgo crítico). Pasa a live al conectar Shopify (dominio + token).

**Ask AI, qué hace:** resumen, pedidos riesgosos, explicar un pedido, qué reponer, y:

| Acción | Regla |
|---|---|
| Retener un pedido para revisión | Automática, con Undo |
| Borrador de reposición (nada se envía al proveedor) | Automática, con Undo |
| Aprobar un pedido | Automática solo si es de riesgo bajo, sin revisión pendiente y es de la tienda demo; si no, confirmación |
| Cancelar un pedido | **Siempre confirmación**: es irreversible en Shopify |

Un cambio hecho en Shopify real no se puede deshacer desde Helix, y la app lo dice en vez de fingir.

---

## 6. Helix for Inbox

**Qué es:** triage de correo para un EA: prioriza, redacta respuestas y enruta, con revisión humana.

**Páginas:** Dashboard, HITL queue, Followups, Routed, Blocked, SLA, Weekly report, Analytics, Settings, How to use. Integración con Gmail (OAuth) y envío por Gmail o Resend.

**Demo:** 6 hilos (Maya Chen, Priya Shah, Luis Ortega, HVAC Weekly, Dana Ruiz, Crypto Blast). Pasa a live al conectar una cuenta de Gmail. El estado se guarda en una cookie por visitante (serverless), y las acciones de la IA también se escriben ahí.

**Ask AI, qué hace:** qué es urgente, qué necesita respuesta, qué ignorar, y:

| Acción | Regla |
|---|---|
| Redactar borrador, posponer (snooze) | Automática, con Undo |
| Archivar, enrutar | Automática con Undo, salvo hilos urgentes o con revisión pendiente |
| **Enviar la respuesta** | **Siempre confirmación**: es un correo real e irrecuperable |

En demo, "enviar" solo marca el hilo como enviado y lo dice: "nothing was actually emailed". Con Gmail o Resend configurados, envía de verdad.

**Todavía no existe:** el flujo que describiste ("Ava me escribió, búscala en mi calendario y mándale el mensaje"). Falta la integración con Google Calendar, una búsqueda de contactos y que Inbox use el agente con herramientas.

---

## 7. Helix for Marketing

**Qué es:** calidad del gasto publicitario: une el gasto de Meta/Google con la calidad de los leads para ver cuánto va a leads spam.

**Demo:** 3 campañas (Ad A, Ad B, Ad D), 5 leads, $327.30 de gasto en 7 días; la peor es "Ad A — volume HVAC". Pasa a live al conectar Meta (access token + ad account). Los datos de demo ya no se guardan en archivo, así que un seed viejo nunca se confunde con datos reales.

**Ask AI, qué hace:** dónde se desperdicia gasto, campaña peor, cuáles escalar, resumen, y:

| Acción | Regla |
|---|---|
| Mantener una campaña ("Keep Ad D") | Automática, con Undo (solo local, no toca el ad platform) |
| Pausar / escalar | **Siempre confirmación**: toca la entrega de anuncios y gasta dinero |

Pausar/escalar escribe en Meta solo si Meta está conectado; si no, guarda la decisión local y lo dice.

**Despliegue:** estuvo fallando por la configuración del proyecto de Vercel (Output Directory). Ya está corregido y en producción.

---

## 8. Helix for Real Estate (nuevo, Fase 0, solo local)

**Qué es:** listings con IA, scoring de compradores y match entre compradores y propiedades, con aprobación del agente.

**Marca:** logo oficial dorado y azul marino; acento dorado `#C9A24B`; títulos en Cinzel.

**Hay hoy:** Dashboard, Properties (con detalle), Leads (con detalle), How to use. Demo de 10 propiedades, 20 compradores y 1 zona de mercado (toda cifra de mercado dice "Demo data"). Scoring con "Why this score?" (5 factores) y 3 propiedades sugeridas por comprador, con razones y advertencias. Ask Helix AI con enlaces a la propiedad o al comprador que menciona y botón Watch Helix work.

**Tiers:** hot ≥85, warm 60–84, cold <60 (en la demo: 6 hot, 10 warm, 4 cold).

**No hay todavía:** listing con IA en borrador, respuestas con aprobación, acciones de la IA, Supabase, modo live, importación CSV, push a GHL/HubSpot. Es la Fase 1 en adelante del roadmap.

**Sin desplegar:** hay que commitear y crear el proyecto `helix-for-real-estate` en Vercel (Root Directory `apps/real-estate`).

---

## 9. Pendientes y riesgos transversales

1. **Agente con calendario/envío real (Inbox)** y herramientas para el resto: el motor está, falta registrar herramientas y probarlo con la API real.
2. **Demo en producción en memoria:** compartida entre visitantes hasta Reset. Alternativa más aislada: una copia por visitante con cookie.
3. **Cliente real:** poner `HELIX_DESK_SEED=off` en su proyecto de Vercel, o verá datos ficticios hasta conectar.
4. **Commerce:** confirmar su estado de demo en producción (su URL con alias me pidió autenticación al probarla).
5. **Dos hallazgos de seguridad por revisar aparte** (Leads, ya existentes): lectura de caché sin filtro de organización en `getLead`; y el "Undo" de Leads reenvía desde el cliente el estado anterior (el servidor valida el formato, no que sea auténtico).
6. **Texto "los …" cortado** en un mensaje anterior: sigo sin saber qué faltaba por agregar.
7. **Memoria (claude-mem):** sin captura mientras dure el límite de cuota del observador.
