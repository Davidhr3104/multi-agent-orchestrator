# Helix: producción e integraciones

**Fecha:** 2 oct 2026 (actualizado tras la ronda de 7 subagentes) · **Rama:** `feature/lead-scoring-template`

Las 7 URLs respondieron 200 el 2 oct 2026, y cada una muestra el título del Helix correcto. Los cambios de esta ronda están **sin commit ni deploy**: producción todavía no los tiene.

**Estados de una integración:**
- **Implementada:** el código llama a la API real cuando hay credenciales, y ya existía antes de esta ronda.
- **Nueva, sin verificar:** se construyó en esta ronda, con tests sobre llamadas simuladas. Nunca se probó contra la API real porque no hay credenciales.
- **Solo token:** se puede guardar el token, pero ningún código lee ni escribe con él.
- **Mencionada:** aparece en la interfaz, sin adaptador.
- **No existe:** hay que construirla.

**Reglas que se aplican en los 7 Helix:**
- Lo que envía, publica, gasta o escribe en un sistema externo siempre pide confirmación humana.
- Los números los calcula el código. Claude solo redacta, y si mete un número o un dato que no recibió, su texto se descarta.
- Nada dice "connected" ni "live" sin una respuesta real de la API.

---

## Común a todos

| Herramienta | Para qué | Estado |
|---|---|---|
| Vercel | Hosting y crons (todos diarios o semanales, compatibles con el plan Hobby) | Implementada |
| Supabase | Base de datos (se suspende mientras el desk está en demo) | Implementada (Real Estate y Social Media aún guardan en memoria) |
| Claude (Anthropic) | Ask Helix AI, análisis y redacción. Sin `ANTHROPIC_API_KEY`, usa reglas o plantillas y lo indica | Implementada; falta poner la clave |
| Costo de IA | Tokens y USD estimados por llamada, visibles en cada desk | Nueva, sin verificar |
| Cron protegido | Rutas `/api/cron/*` con `CRON_SECRET` (503 sin secreto, 401 con token incorrecto); solo proponen, nunca ejecutan | Nueva, sin verificar |

---

## Helix for Leads

**Producción:** https://helix-for-leads.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| GoHighLevel | Sincroniza los leads aprobados al CRM | Implementada |
| Slack | Alertas por webhook | Implementada |
| CSV | Importar y exportar leads | Implementada |
| Entrada pública de leads + Claude | `/api/leads/intake/<token>`: clasifica, puntúa con citas del lead y redacta el siguiente paso | Nueva, sin verificar |
| HubSpot | Sync de leads aprobados (upsert por email) | Nueva, sin verificar |
| Cron diario | Triage de leads nuevos; nunca empuja al CRM | Nueva, sin verificar |

**Variables:** `ANTHROPIC_API_KEY`, `HUBSPOT_TOKEN`, `CRON_SECRET`, `HELIX_INTAKE_TOKEN` (si no hay Supabase). Hay que correr `supabase/phase6-ai.sql`.

## Helix for Legal

**Producción:** https://helix-for-legal.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| Documentos (PDF) y CSV | Subir RFPs y datos de la firma | Implementada |
| SAM.gov | Importar RFPs federales reales (NAICS y estado según el perfil de la firma) | Nueva, sin verificar |
| Claude | Extracción con citas verificadas, recomendación Go/No-Go y chequeo de conflictos. La decisión siempre es del socio | Nueva, sin verificar |
| Cron diario | Trae oportunidades nuevas como "propuestas para revisión" | Nueva, sin verificar |

**Variables:** `SAM_GOV_API_KEY` (sam.gov → Account Details → Public API Key), `ANTHROPIC_API_KEY`, `CRON_SECRET`. **Límite:** los adjuntos de SAM.gov todavía no se leen.

## Helix for Commerce

**Producción:** https://helix-for-commerce.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| Shopify | Pedidos, productos, inventario, retener, aprobar y cancelar | Implementada |
| Slack | Alertas por webhook | Implementada |
| Claude | Explicación de fraude con campos citados, reposición según ventas reales y resumen diario | Nueva, sin verificar |
| Cron diario | Revisa pedidos nuevos y llena la "Approval queue"; nunca aprueba ni cancela | Nueva, sin verificar |

**Variables:** `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ACCESS_TOKEN` (la guía está en Settings), `ANTHROPIC_API_KEY`, `CRON_SECRET`. **Pendiente:** actualizar la versión de la API de Shopify (`2024-10`).

## Helix for Inbox

**Producción:** https://helix-for-inbox.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| Gmail | Leer (OAuth) y enviar respuestas | Implementada |
| Resend | Envío de correo alternativo | Implementada |
| Calendly | Leer los eventos agendados | Implementada |
| HubSpot | Crear un deal desde un hilo | Implementada |
| Slack | Alertas de SLA | Implementada |
| Google Calendar | Eventos, reuniones con un contacto y huecos libres (solo lectura) | Nueva, sin verificar |
| Agente con herramientas | Flujo "Ava me escribió": busca el hilo, mira el calendario, redacta y se detiene antes de enviar | Nueva, sin verificar |
| Claude | Prioridad con citas verificadas y borradores con tu estilo | Nueva, sin verificar |
| Twilio (SMS/WhatsApp) | Envío siempre con confirmación | Nueva, sin verificar |
| Cron diario | Clasifica correo nuevo y prepara borradores; nunca envía | Nueva, sin verificar |

**Variables:** `GOOGLE_OAUTH_CLIENT_ID/SECRET` (agregar el scope `calendar.events.readonly`; las cuentas ya conectadas deben reconectarse), `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `ANTHROPIC_API_KEY`, `CRON_SECRET`.

## Helix for Marketing

**Producción:** https://helix-for-marketing.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| Meta Ads | Leer el gasto; pausar o escalar con confirmación. Ahora solo dice "live" tras una lectura real | Implementada |
| CSV | Cargar el gasto real | Implementada |
| Slack | Alertas por webhook | Implementada |
| Google Ads | Gasto por campaña y día (solo lectura) | Nueva, sin verificar |
| TikTok Ads | Gasto por campaña y día (solo lectura) | Nueva, sin verificar |
| Claude | Informe de gasto desperdiciado con números calculados en código | Nueva, sin verificar |
| Cron diario | Refresca el gasto y genera informe y propuestas; nunca pausa ni escala | Nueva, sin verificar |

**Variables:** `GOOGLE_ADS_*` (el developer token necesita Basic access, que tarda días), `TIKTOK_ADS_ACCESS_TOKEN`, `TIKTOK_ADS_ADVERTISER_ID`, `ANTHROPIC_API_KEY`, `CRON_SECRET`. Se quitaron cifras inventadas de la página Waste.

## Helix for Social Media

**Producción:** https://helix-for-social-media.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| Instagram / Facebook (Meta) | Leer posts e insights; publicar posts aprobados | Nueva, sin verificar |
| LinkedIn | Publicar posts aprobados de la organización (solo texto) | Nueva, sin verificar |
| X / TikTok | Detecta el token | Solo token |
| Claude | Borradores basados en los mejores posts reales y reporte semanal | Nueva, sin verificar |
| Cron | Refresca insights a diario y prepara borradores los lunes; nunca publica | Nueva, sin verificar |

**Variables:** `HELIX_META_ACCESS_TOKEN`, `HELIX_META_IG_USER_ID`, `HELIX_META_PAGE_ID`, `HELIX_META_PAGE_ACCESS_TOKEN`, `HELIX_LINKEDIN_ACCESS_TOKEN`, `HELIX_LINKEDIN_ORGANIZATION_URN`, `HELIX_SOCIAL_PUBLISH=live` (para publicar), `ANTHROPIC_API_KEY`, `CRON_SECRET`. **Límite:** guarda en memoria; para producción hace falta Supabase.

## Helix for Real Estate

**Producción:** https://helix-for-real-estate.vercel.app

| Herramienta | Para qué | Estado |
|---|---|---|
| Realtor.com | Mercado de EE.UU. por estado (CSV mensual público) | Implementada |
| Mapas Esri + Leaflet | Mapa del US Market | Implementada |
| CSV / Google Sheet | Importar propiedades y compradores reales (reemplaza el demo) | Nueva, sin verificar |
| Claude | Copy de listing, explicaciones de match, alertas y brief de mercado | Nueva, sin verificar |
| Resend / Twilio | Enviar alertas aprobadas, con confirmación por mensaje | Nueva, sin verificar |
| HubSpot | Empujar un comprador, con confirmación | Nueva, sin verificar |
| Cron diario | Matching de propiedades nuevas o cambiadas; encola borradores y nunca envía | Nueva, sin verificar |
| GoHighLevel, Zapier, portales | Integraciones de CRM y portales | Mencionada |

**Variables:** `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `RESEND_FROM`, `TWILIO_*`, `HUBSPOT_TOKEN`, `CRON_SECRET`. **Límite:** guarda en memoria, así que lo importado se pierde con cada deploy; para producción hace falta Supabase.

---

## Pendientes transversales

1. **Cambios en `packages/helix-core`: hechos.**
   - `askAi`, `askAiWithProposal`, `completeWithClaudeDetailed` y el agente devuelven y reportan los tokens. Cualquier app puede sumarlos con `onClaudeUsage()` y `estimateClaudeCostUsd()`.
   - Las claves nuevas se pueden guardar desde Settings, y hay `KEYS_SOCIAL` y `KEYS_REAL_ESTATE`. `HELIX_SOCIAL_PUBLISH` queda solo como variable de entorno, a propósito.
   - Helper `cronAuthResponse()` para los crons.
   - `"tiktok"` agregado a `AdPlatform`; Marketing lo guarda y lo lee correctamente en Supabase.
   - En el agente: el modelo por defecto es `claude-sonnet-4-20250514`, los errores muestran el mensaje de Anthropic, se eliminan los turnos vacíos, no se pierden los pasos si el modelo falla y, al reanudar, se vuelve a comprobar el riesgo antes de ejecutar algo aprobado.
   - **Falta:** conectar `onClaudeUsage()` al panel de costo de cada app (para que Ask AI también cuente) y migrar los crons de cada app al helper compartido.
2. **Persistencia en Supabase** para Real Estate y Social Media.
3. **Primera prueba real:** poner `ANTHROPIC_API_KEY` y la credencial de una fuente, y medir el costo real por llamada.
4. **Commit y deploy** de esta ronda, cuando se apruebe.
