# Helix — Data, integraciones entre apps y Automatizaciones

Guía de construcción. Fecha: 2026-10-06. Estado: **borrador de diseño** para Data e integraciones; **Automatizaciones v1 ya construida en Inbox** (local, sin commit ni deploy).
Escrito para: David (y quien implemente). Idioma: español; identificadores en inglés.
Confianza: media en el diseño de Data y de eventos (nada de eso existe todavía); alta en lo descrito como "construido" (con tests y prueba en navegador local). Lo no verificado está marcado como **[no verificado]**.

---

## 0. Resumen y orden de construcción

Tres piezas que se apoyan una en otra:

| Pieza | Qué es | Estado |
|---|---|---|
| **Automatizaciones** | Rutinas programadas con canvas visual, creadas hablando con Helix o por formulario | **v1 construida en Inbox** |
| **Integraciones entre Helix** | Eventos tipados y firmados entre apps ("propiedad nueva → borrador de post") | Diseño |
| **Helix Data** | Escritorio para hojas Excel/Sheets: perfilar, limpiar con trazabilidad, publicar a otros Helix | Diseño |

Orden recomendado:

1. Cerrar Automatizaciones en Inbox (cron, Slack real, commit) y replicarlas en Commerce.
2. Capa de eventos entre apps, con **un** flujo cuyos dos extremos ya existen (Real Estate → Social).
3. Helix Data v1 (subir, perfilar, reglas deterministas, diff, exportar).
4. Flujo piloto **Data → Leads + Marketing** (dos hojas sucias → leads puntuados + gasto en spam).
5. Nodos de Data y de otras apps dentro del canvas de Automatizaciones.

---

## 1. Principios (aplican a las tres piezas)

1. **Juicio de IA separado de lógica determinista.** La IA solo traduce una frase, propone un mapeo o sugiere una normalización. Validar, programar, transformar, medir y enviar es código.
2. **El contenido sale de los datos, nunca de la IA.** "12 órdenes, $1,840" se cuenta; la IA no inventa cifras.
3. **Nunca fallar en silencio.** Cada ejecución, rechazo y fallo queda registrado y visible, y se avisa por un canal distinto al que falló.
4. **Helix nunca dice "ya está" si no es verdad.** Una automatización es `active` solo si el validador lo confirma; si no, es `draft` y se dice qué falta.
5. **La IA propone, el humano aprueba** lo que toca a terceros, publica o es irreversible. Un cambio entre apps no se salta la aprobación del destino.
6. **Catálogo cerrado.** Solo existen los nodos, eventos y contratos declarados. Sin HTTP libre en v1 (evita SSRF y fugas de secretos).
7. **Trazabilidad de origen.** Todo lo que cruza de una app a otra lleva "creado por X, ejecución Y".
8. **Verticales aisladas.** Ninguna app lee la base de otra. Se hablan por contratos y eventos.
9. **Honestidad en demo.** Lo simulado se etiqueta ("Demo data"); en demo nada se envía de verdad.
10. **Formatos de la familia:** dinero `$85,000`, fechas ISO `2026-09-18`.

---

## 2. Módulo de Automatizaciones

### 2.1 Qué hace

Cada Helix tiene una sección **Automations** con cuatro bloques: *Incluidas* (lo que el Helix ya hace por cron), *Tuyas* (creadas con Helix), *Crear* (formulario) e *Historial*. Cada rutina se dibuja como un **canvas de flujo** (`Trigger → Data → Send → History`).

El usuario puede escribir "Send me a summary of my inbox every day at 9pm on Slack". Helix devuelve una propuesta que hay que **confirmar** y responde según los hechos:

- Todo conectado → *activa*, y enumera exactamente qué enviará.
- Falta algo → *borrador*, con la lista de faltantes y un botón por cada uno (Connect, Set it, Add number). No se envía nada hasta completarlo.

### 2.2 Lo construido (Inbox)

| Capa | Archivo | Rol |
|---|---|---|
| Modelo y reglas (compartido) | `packages/helix-core/src/automations/{types,schedule,validate}.ts` (subpath `@helix/core/automations`) | `AutomationSpec`, `validateSpec`, `deriveStatus`, horarios con zona horaria y DST, `dueRun` idempotente |
| Catálogo | `apps/inbox/src/lib/automations/catalog.ts` | Fuentes (`inbox.daily_digest`, `inbox.sla_breaches`) y canales (in-app, Slack, WhatsApp/SMS vía Twilio) |
| Contenido | `.../digest.ts` | Texto del mensaje con `deskCounts`, los mismos números que dashboard y SLA |
| Frase → spec | `.../parse.ts` | Parser determinista, bilingüe; **no inventa** hora, canal ni teléfono |
| Estado y chat | `.../service.ts` | Transiciones puras (crear, confirmar, pausar, zona, destinatario) y `chatReply` |
| Ejecución | `.../runner.ts`, `.../senders.ts` | Nunca lanza; todo resultado es un `AutomationRun`. Slack solo a `hooks.slack.com` |
| Persistencia | `.../storage.ts` | Desk en vivo → Supabase (dentro del JSON de preferencias, sin tabla nueva); demo → cookie (máx. 4) |
| Canvas | `.../graph.ts` + `packages/helix-ui/src/flow-canvas.tsx` | `specToGraph` y componente reutilizable `FlowCanvas` |
| API | `app/api/automations/route.ts`, `app/api/cron/automations/route.ts` | Una ruta con acciones validadas y el cron |
| Chat | `lib/ai-actions.ts` (`create_automation`), `lib/demo-assistant.ts`, `app/api/ask-ai/route.ts` | Siempre pide confirmación; Undo la borra |
| UI | `app/automations/page.tsx` | La página; nav "Automations" |

Pruebas: `helix-core` 24 (automations) + 175 totales; `helix-ui` 35; Inbox 126. Probado en navegador local: crear por chat, borrador honesto, vista previa con números reales, crear por formulario, móvil sin desborde, sin errores de consola.

### 2.3 Modelo

```ts
type AutomationSpec = {
  id: string; name: string;
  origin: "builtin" | "user";
  status: "draft" | "active" | "paused";
  trigger: { kind: "daily"; time: "HH:MM"; tz: string } | { kind: "manual" };
  steps: Array<{ type: "source"; node: string } | { type: "send"; channel: Channel; to?: string }>;
  createdBy: "chat" | "canvas" | "seed";
  confirmedAt: string | null;          // consentimiento explícito del usuario
  missing: Requirement[];              // qué falta para activarla
  createdAt: string; updatedAt: string;
};
type AutomationRun = {
  id; automationId; key;               // key = automationId@scheduledFor → idempotencia
  status: "ok" | "failed" | "skipped" | "expired";
  trigger: "schedule" | "manual"; preview: boolean;
  error?: string; text?: string; delivered?: Channel[];
};
```

Reglas clave:

- `status = active` solo si `validateSpec` no tiene faltantes **y** hay `confirmedAt`.
- Enviar de verdad exige `confirmedAt`; sin él, el runner devuelve un run `failed` con la razón.
- Una ejecución ya registrada (incluso fallida) nunca se vuelve a deber: no hay reenvío silencioso.
- Una ejecución perdida por más de 3 h se registra como `expired`; nunca se envía tarde.

### 2.4 Cómo replicarlo en otra app (receta)

1. **`catalog.ts`**: declarar fuentes (funciones puras sobre los datos de esa app) y canales conectados. Ej. Commerce: `commerce.daily_sales`, `commerce.restock_list`.
2. **`digest.ts`**: construir el texto desde las mismas métricas que ya usa la app (nunca recalcular distinto).
3. **`storage.ts`**: reutilizar el patrón (preferencias en vivo, cookie en demo).
4. **Rutas**: copiar `api/automations` y `api/cron/automations`.
5. **Chat**: registrar `create_automation` en el registro de acciones de esa app y una rama en su asistente demo.
6. **Página y nav**: reutilizar `FlowCanvas` y el esquema de la página.

Candidatas: Commerce (resumen de ventas, qué reponer), Leads (leads calientes sin atender), Marketing (gasto en spam por campaña), Social (posts por aprobar).

### 2.5 Pendiente de Automatizaciones

| Pendiente | Nota |
|---|---|
| **Cron programado** | La ruta existe y se probó con tests, pero **no está en `vercel.json`**. Hace falta un cron cada pocos minutos; el plan gratuito de Vercel solo permite crons diarios y podría romper el deploy **[verificar el plan]** |
| **WhatsApp** | Twilio ya está en Inbox. Fuera de la ventana de 24 h Meta exige plantilla aprobada; un resumen de las 9 pm cae ahí. Decidir plantilla y proveedor (Twilio vs Cloud API) |
| **Editor del canvas** | Hoy es solo lectura. Siguiente fase: añadir pasos, reordenar, ramas, esperas |
| **Zona horaria** | Hoy un ajuste por desk; decidir si es por usuario o por tienda |
| **Reintentos** | v1 no reintenta; el fallo queda visible y se puede "Send now" |
| **Multi-tenant de conexiones** | Meta/LinkedIn hoy son tokens de entorno de un solo dueño |

### 2.6 Seguridad de claves (hecho en esta sesión)

- Antes: el GET público de `/api/settings/keys` devolvía primer y último fragmento de cada secreto (incluida `HELIX_OPERATOR_KEY`). Ahora devuelve solo `••••`.
- En un despliegue alojado (`VERCEL`) sin `HELIX_OPERATOR_KEY`, guardar claves responde 403.
- **Producción sigue con el comportamiento viejo hasta desplegar.**
- Corrección de una afirmación anterior: las rutas de claves ya exigían operador en producción (401 verificado).

---

## 3. Integraciones entre Helix

### 3.1 Qué existe hoy

Solo hay **una** conexión entre apps, y es suelta: Inbox → Leads, `sendToLeadsDesk` en `apps/inbox/src/lib/leads-handoff.ts`, por webhook (`HELIX_LEADS_WEBHOOK_URL`). La idea es generalizar ese patrón.

### 3.2 Diseño: eventos, no bases compartidas

Cada app declara qué eventos **emite** y cuáles **acepta**, con contratos tipados en `@helix/core` (subpath `@helix/core/events`, nuevo).

```ts
type HelixEvent<T> = {
  id: string;                    // único
  type: "realestate.listing.created";
  version: 1;
  sourceApp: "real-estate";
  orgId: string;                 // identidad compartida (ver 3.5)
  occurredAt: string;            // ISO
  idempotencyKey: string;        // el destino descarta duplicados
  payload: T;
  provenance: { createdBy: string; runId?: string };
};
```

**Entrega**

- POST HTTPS firmado: HMAC-SHA256 de `timestamp.body` con un secreto por conexión; tolerancia de 5 min. Reutilizar el patrón de `action-token` del core.
- El receptor valida firma, esquema y versión, y responde 202.
- **Outbox** en el emisor (`pending` → `delivered` | `failed`), reintentos con espera creciente (p. ej. 3), y una cola de fallos **visible** en la UI. Nunca se descarta en silencio.

**Conexión entre apps** (`app_links`): `{ orgId, fromApp, toApp, url, secretRef, eventTypes[], status }`. Se crea con el botón **Connect** ("Conectar Helix for Social"), con alcance limitado a los tipos de evento listados.

**Regla de oro:** el evento crea un **borrador o una propuesta** en el destino; lo que publica o envía sigue pasando por la aprobación humana del destino.

### 3.3 Catálogo de eventos v1

| Evento | De → A | Estado |
|---|---|---|
| `inbox.thread.lead_intent` | Inbox → Leads | **Existe** (webhook actual) |
| `realestate.listing.created` | Real Estate → Social | Propuesto (piloto) |
| `social.engagement.lead_intent` | Social → Leads | Propuesto |
| `commerce.customer.segment_ready` | Commerce → Data → Leads | Propuesto |
| `data.dataset.published` | Data → cualquiera | Propuesto (ver §4) |
| `video.clip.ready` | Video/Edit → Social | Futuro (esas apps no existen) |

### 3.4 Flujo piloto: Real Estate → Social

Ambos extremos existen y es visual.

1. Se crea una propiedad en Real Estate → emite `realestate.listing.created` (título, precio con formato `$1,450,000`, zona, fotos).
2. Social recibe el evento y crea un **borrador** de post con su puntaje de *readiness*, marcado "creado por Helix for Real Estate, ejecución X".
3. Una persona aprueba en Social; publicar sigue exigiendo el interruptor `HELIX_SOCIAL_PUBLISH=live` y el clic de Publish.

**Criterios de aceptación**

- Crear una propiedad genera exactamente un borrador (un evento repetido no duplica).
- Si Social no está conectado, el emisor lo registra y lo muestra; no desaparece.
- El borrador lleva el origen, y el audit de Social lo registra.
- Nada se publica sin aprobación.
- En demo el flujo se etiqueta como simulado.

### 3.5 Identidad (bloqueo conocido)

Cada app es un proyecto de Vercel distinto y la demo es de un solo inquilino. Los flujos entre apps de verdad necesitan un **`orgId` compartido** y un esquema común de organizaciones. Sin eso, solo funcionan en demo.

---

## 4. Helix Data

### 4.1 Qué es

Escritorio para hojas Excel y Google Sheets y **centro de la familia**: recibe archivos desordenados, los perfila, los limpia con trazabilidad y los **publica a otros Helix** (Leads, Marketing, Commerce, Real Estate, Legal, Inbox, Social). También recibe datos de vuelta (leads, reportes, auditoría) y los deja en una hoja.

Data limpia y mapea; **cada app conserva sus reglas de negocio** (Data no puntúa leads: entrega filas limpias y Leads las puntúa).

### 4.2 Pipeline (mismos agentes de la familia)

| Etapa | Agente | Qué hace | Tipo |
|---|---|---|---|
| Leer | — | Parsear `.xlsx` / `.csv` / Google Sheet | determinista |
| Perfilar | EXT | Tipos, completitud, duplicados, formatos mezclados | determinista |
| Mapear | EXT + IA | Columna → campo del contrato destino, con confianza y evidencia | **IA, con aprobación** |
| Verificar | FACT | Marca como `unverified` lo ambiguo; nunca inventa | determinista + IA |
| Proponer | REC | Arreglos como diff celda a celda | mixto |
| Aprobar | REV (humano) | Aprobar por problema o por lote | humano |
| Publicar | — | Validar contra el contrato y enviar | determinista |

### 4.3 Reglas deterministas v1

Quitar espacios; normalizar mayúsculas; email (sintaxis); teléfono a E.164; fechas a ISO; dinero a `$85,000`; duplicados exactos y por clave normalizada; columnas vacías; tipos mezclados; atípicos (se **marcan**, no se cambian).

Pueden **auto-aprobarse por regla** porque son reversibles y verificables. Todo lo que propone la IA exige confirmación.

**Fechas ambiguas** (¿03/04?): se pregunta, nunca se adivina.

### 4.4 Qué va a la IA

Solo: sugerir el mapeo de columnas, normalizar categorías ("NY", "New York") y decidir duplicados dudosos. Para limitar datos personales, el modelo recibe **encabezados y una muestra enmascarada**, no la hoja completa, salvo que el usuario lo autorice.

### 4.5 Modelo de datos

```
datasets            id, orgId, name, source(file|sheet), createdAt
dataset_versions    id, datasetId, storageKey, rows, hash        -- inmutables
column_profiles     versionId, column, type, completeness, issues
issues              id, versionId, column, ruleId, severity
proposed_changes    id, issueId, cellRef, before, after, ruleId, origin(rule|ai), confidence, evidence
decisions           changeId, decidedBy, decidedAt, status
publications        id, versionId, targetApp, contractVersion, accepted, rejected, idempotencyKey
```

**Trazabilidad por celda:** "valor original, regla, origen (regla/IA), confianza, quién aprobó, cuándo". Es el diferencial del producto.

**Nunca se sobrescribe el original.** La salida es un archivo nuevo o una pestaña nueva; por eso "deshacer" es descartar la copia.

### 4.6 Contratos de importación

Cada app registra qué acepta:

```ts
type ImportContract = {
  app: "leads" | "marketing" | "commerce" | "real-estate" | ...;
  name: string; version: number;
  fields: { name: string; type: "text"|"email"|"phone"|"money"|"date"|"number"; required: boolean }[];
  maxRows: number;
};
```

Data valida contra el contrato, muestra los rechazos con la razón y hace un **dry-run** antes del envío real.

**Puntos de entrada que ya existen** (Data puede apoyarse en ellos desde el día uno):

| Destino | Entrada existente |
|---|---|
| Leads | `POST /api/leads/intake/[token]` (`apps/lead-scoring/src/lib/intake.ts`, `HELIX_INTAKE_TOKEN`) |
| Marketing | `parseSpendCsv` (`packages/helix-core/src/marketing/spendCsv.ts`) y `POST /api/campaigns/ingest` |
| Commerce | `parseCatalogCsv` (`packages/helix-core/src/commerce/catalogCsv.ts`) |
| Real Estate | `apps/real-estate/src/lib/import.ts` y `/api/import` |

Hoy cada importador tiene su propio formato. Data los unifica con contratos y los convierte en consumidores.

### 4.7 Técnica

- **Archivos:** SheetJS o ExcelJS para `.xlsx`; el parser de CSV (RFC-4180) que ya existe.
- **Subida:** los archivos grandes no caben en una petición normal de Vercel (límite de cuerpo cercano a 4,5 MB **[verificar]**). Subir a almacenamiento (Supabase Storage) y procesar por partes. v1: tope de unas 5.000 filas.
- **Google Sheets:** API con permiso **solo lectura** más selector de archivos con alcance mínimo. Escribir siempre a una hoja nueva.
- **Visual:** reutilizar `@helix/ui` (mapa de calor de problemas por columna, anillo de completitud, barras) y construir una cuadrícula antes/después.
- **Páginas:** `/datasets`, `/datasets/[id]` (perfil), `/datasets/[id]/review` (diff), `/datasets/[id]/publish`, historial.

### 4.8 Piloto: Data → Leads + Marketing

Dos hojas sintéticas sucias: `leads.csv` y `gasto.csv`.

1. Data perfila ambas, propone arreglos y el usuario aprueba el diff.
2. Publica `leads` al intake de Leads (que los puntúa) y `gasto` a Marketing.
3. Marketing muestra cuánto gasto fue a leads spam.

**Criterios de aceptación**

- Una fila rechazada aparece con su razón; ninguna se pierde en silencio.
- Reenviar el mismo lote no duplica filas (idempotencia).
- Cada celda cambiada tiene regla, origen y aprobador.
- El original queda intacto.
- Los totales publicados coinciden con los mostrados en Leads y Marketing.

---

## 5. Seguridad y privacidad (transversal)

- **Claves:** el cierre de la fuga descrito en §2.6 es **prerrequisito** para guardar conexiones de usuarios reales. Guardarlas cifradas, por organización, sin devolverlas nunca; botón **Probar conexión**.
- **Webhooks de salida:** lista de destinos permitidos; solo HTTPS; sin IPs privadas (el patrón ya existe en `api/sla/alert`).
- **Eventos:** firma, marca de tiempo, idempotencia y esquema versionado.
- **Datos de Data:** política de retención (propuesta: 7 días por defecto), botón de borrado, y en la demo solo datos sintéticos. Sin datos personales en logs.
- **Consentimiento de envíos:** `confirmedAt` en cada automatización; los envíos a terceros requieren aprobación.

---

## 6. Riesgos y decisiones abiertas

1. **Alcance de Data:** confirmado como "centro de la familia" y puerta de importación. ¿Quién tiene las hojas sucias (agencias, ventas, operaciones)? Decide las reglas que se incluyen primero.
2. **Identidad compartida** (`orgId`) entre apps separadas.
3. **Fuente de verdad** cuando el mismo dato vive en dos Helix.
4. **WhatsApp:** proveedor, plantilla aprobada, costo por conversación y consentimiento.
5. **Cron:** plan de Vercel y precisión.
6. **Mantenimiento:** cada contrato y evento es una promesa; mantener el catálogo corto.
7. **Apps futuras** (Video, Edit): no existen y el briefing dice no empezarlas sin pedirlo.
8. **Formatos:** `.xlsx` con fórmulas, celdas combinadas y varias pestañas; codificaciones; fechas dd/mm vs mm/dd.

---

## 7. Plan por fases

| Fase | Contenido | Resultado verificable |
|---|---|---|
| **A1** | Automatizaciones Inbox: cron programado, probar Slack con un webhook real, commit separado | Una rutina se ejecuta sola y queda en el historial |
| **A2** | Replicar en Commerce (resumen de ventas, qué reponer) | Los números coinciden con las páginas de Commerce |
| **B1** | Módulo `@helix/core/events`: envoltorio, firma, outbox, `app_links` | Tests de firma, idempotencia y reintentos |
| **B2** | Piloto Real Estate → Social | Criterios de §3.4 |
| **C1** | Helix Data v1: subir, perfilar, reglas, diff, exportar | Criterios de §4.8 (sin publicar) |
| **C2** | Publicar Data → Leads + Marketing con contratos y dry-run | Piloto de §4.8 completo |
| **C3** | Mapeo y normalización con IA | Cada propuesta con confianza y evidencia |
| **C4** | Conector de Google Sheets (solo lectura, escritura a hoja nueva) | Misma salida que con archivo |
| **D** | Editor del canvas; nodos de Data y de otras apps; WhatsApp con plantilla | Un flujo entre apps editable |

---

## 8. Lo que NO está verificado

- **Envíos reales** por Slack, Twilio y WhatsApp: los tests usan senders falsos; la demo nunca envía.
- **Persistencia en vivo** de Automatizaciones en Supabase: escrita, no ejercitada.
- **Cron programado**: no está en `vercel.json`.
- **Conectores** de Gmail, Shopify, Meta, SAM.gov y GoHighLevel: existen en el código, sin probar contra servicios reales.
- Todo lo de **§3 y §4** es diseño: no hay código.
- Los límites de Vercel (cuerpo de petición, crons) vienen de memoria.

---

## Anexo: documentos relacionados

- `docs/superpowers/specs/2026-10-06-helix-automations-design.md`: diseño original de Automatizaciones (borrador previo; este documento lo actualiza con lo construido en Inbox).
- `docs/HELIX-INTEGRACIONES.md`: mapa de integraciones externas.
- `docs/HELIX-FASE-2-Y-3-PLAN.md`: plan de fases 2 y 3.
- `docs/HELIX-MAPA-DE-ESTADO-2026-10-05.md` (en `helix-knowledge/docs`): estado de producción.
