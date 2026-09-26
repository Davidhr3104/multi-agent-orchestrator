# Helix for Leads — Fase B (Triaje power-user) — Design Spec

**Fecha:** 2026-09-24
**Fuente:** `HELIX-LEADS-ROADMAP-UNIFICADO.md`, sección "Fase B — Triaje power-user (siguiente sprint)".
**Alcance:** 3.1 (bulk + hover preview), 3.6 (cola HITL first + empty CTA / F-3), 4.3 (audit completo por
transición), 5.2 (duplicados), P2 rutas legacy (verificación, no-op).
**App:** `apps/lead-scoring` (Helix for Leads), monorepo `helix-lead-scoring-template`.
**Precedente:** Fase A completa en la misma rama (`feature/lead-scoring-template`), commits hasta `50ab93e`.
Este spec parte de ese HEAD. No se toca `apps/commerce`, `apps/legal`, `apps/marketing`.

---

## 0. Estado actual verificado (no inventado — confirmado por lectura directa de código)

- **Bulk backend:** `apps/lead-scoring/src/app/api/leads/bulk/route.ts` ya soporta acciones
  `delete`/`review`/`archive`/`ghl` sobre un array de ids, protegido por `requireOperator` +
  `withOrgScope`. Completo, funcional, sin cambios estructurales necesarios salvo el fix de
  persistencia de fallos (ver sección 1).
- **Bulk UI:** no existe en ninguna ruta activa (`/leads`, `/inbox`). Existe un patrón ya escrito
  (checkboxes, `Set<string>` de seleccionados, `toggleCheck`/`toggleAllVisible`, llamada directa a
  `/api/leads/bulk`) en `apps/lead-scoring/src/components/lead-dashboard.tsx` — un componente de
  1780 líneas que **ningún archivo bajo `app/**` importa** (código muerto, verificado por grep).
  Se reutiliza el patrón de selección de ese archivo (líneas ~398-439), no el archivo completo.
- **Cola HITL:** `AttentionQueue.tsx` ya existe y ya filtra `needsReview === true`, pero vive en
  paridad de grid (misma fila, misma prioridad visual) con `StreamChart` dentro de
  `TriageOverview.tsx` (la vista montada en `/`). No hay reordenamiento condicional ni empty state
  dedicado — el layout es fijo sin importar si hay 0 o N leads pendientes.
- **Audit:** `audit/page.tsx`, función `buildEvents()`, sintetiza eventos client-side (no hay
  persistencia server-side; esto no cambia en Fase B — sería una reestructuración mayor fuera de
  alcance). Cubre hoy: `scoreHistory` → `INFERENCE`; `crmStatus sent/mocked` → `CRM_SYNC`;
  `crmStatus failed` → `CRM_SYNC_FAILED` (de Fase A); `needsReview` → `OVERRIDE`; `classification
  spam` → `SEC_BLOCK`; ingesta → `INGEST_OK`. NO cubre: archive (`pipelineStage === "lost"` sin
  spam), cambio de stage (`contacted`/`qualified`/`won`), diferenciación entre score inicial y
  rescore manual, ni duplicado detectado.
- **Duplicados:** `findDuplicate()` (`packages/helix-core/src/lead/intelligence.ts:101-119`)
  matchea por email exacto normalizado, teléfono (solo dígitos, ≥7), o company+name exactos
  (company derivado del dominio de email si no viene explícito — no es "dominio puro" como decía
  el roadmap, es más preciso: company+name). Comportamiento actual al encontrar match
  (`finish-ingest.ts:23-34` → `attachIntelligence` en `intelligence.ts:355-469`): **fusión
  automática y silenciosa** — mismo `id`, promedia `score` (`(existing+fresh)/2 + 4`), auto-asigna
  `duplicateOf` apuntando a sí mismo (bug: debería apuntar al lead original distinto), incrementa
  `reingestCount`, agrega nota. Sin banner, sin confirmación humana — exactamente lo opuesto al
  criterio del roadmap ("nunca merge automático sin confirmación"). El único consumidor de
  `reingestCount` en UI es el componente huérfano `lead-dashboard.tsx` (badge "DUP").
- **Rutas legacy:** `/triage`, `/scoring`, `/automations`, `/integrations` (sin prefijo
  `/settings/`) **no existen como archivos de página** y **no hay ningún link roto** apuntando a
  ellas en `app-shell.tsx`, `command-palette.tsx`, o `help/page.tsx` — todo ya apunta a las rutas
  correctas bajo `/settings/`. Este ítem del roadmap no reproduce en el código actual.

---

## 1. 3.1 — Bulk actions + hover preview

### Backend — fix de persistencia en fallos parciales

`bulk/route.ts`, acción `"ghl"`: hoy, si `sendLeadToGhl` falla para un id del lote, solo se agrega
a `errors[]` en la respuesta — **no se llama `patchLead`** para persistir `crmStatus: "failed"` +
`crmError` en ese lead (a diferencia del endpoint individual `/api/leads/[id]/crm`, arreglado en
Fase A). Fix: en la rama de fallo real (no "mocked"/config ausente) dentro del loop de la acción
`"ghl"`, llamar `patchLead(id, { crmStatus: "failed", crmError: result.error }, orgId)` antes de
agregar a `errors[]`, para que el lead quede consistente con el resto del sistema y genere el
evento `CRM_SYNC_FAILED` en audit igual que un push individual fallido.

### UI — selección múltiple en `/leads` e `/inbox`

Reutilizar el patrón de `lead-dashboard.tsx` (no el archivo, el patrón):

```ts
const [checked, setChecked] = useState<Set<string>>(new Set());
function toggleCheck(id: string) { /* mismo patrón */ }
function toggleAllVisible() { /* mismo patrón, sobre los leads visibles con el filtro actual */ }
```

- Checkbox por fila en la tabla/lista de `/leads`. En `/inbox` (que ya filtra solo `needsReview`),
  igual: checkbox por card de la cola.
- Barra de acciones bulk aparece solo cuando `checked.size > 0`, mostrando "N leads selected" +
  botones (Approve & Push, Archive, Delete — mapeados a las acciones ya existentes del endpoint).
- **Confirmación explícita antes de ejecutar:** un modal/diálogo simple ("¿Aprobar y enviar 5
  leads al CRM?") antes de disparar la llamada — criterio de aceptación del roadmap ("confirmación
  N leads").
- **Resultado con fallas parciales:** tras la respuesta, mostrar un toast/resumen "N ok / M
  failed" usando el array `errors[]` que el endpoint ya devuelve — no dejar el estado de
  "éxito total" si hubo fallos parciales.
- **Undo bulk:** reutilizar el mecanismo de undo toast de Fase A (`startUndoWindow`/`undoApprove`
  en `inbox/page.tsx`), extendido a operar sobre un array de ids en vez de uno solo, mostrando
  "Undo bulk approve (N leads)".

### Hover preview

En `/leads`, al hacer hover sobre una fila (sin hacer click/navegar), mostrar un popover con:
nombre, score, tier, primeras ~120 caracteres del mensaje. Se implementa con el mismo primitivo
que ya usa `tooltip.tsx` (Radix, ya presente en el repo) — no se introduce una librería nueva. Solo
en desktop (no se implementa versión touch/mobile en esta fase, ya que hover no aplica ahí).

---

## 2. 3.6 — Cola HITL first

En `TriageOverview.tsx`:

- Cuando `kpis.hitlPending > 0`: `<AttentionQueue>` se renderiza en una fila propia, ancho
  completo, **arriba** de `<KpiStrip>` y `<StreamChart>` — no en el grid de 3/2 columnas actual.
- Cuando `kpis.hitlPending === 0`: en el espacio que ocuparía la cola, mostrar un empty state con
  mensaje claro ("No hay leads pendientes de revisión") y, si aplica (desk vacío/demo), un CTA
  para cargar el seed de demo — reutilizando cualquier acción de "load demo" que ya exista en el
  codebase (verificar en implementación si existe `loadDemoCatalog`/endpoint equivalente ya
  expuesto a la UI antes de construir uno nuevo).
- `KpiStrip`, `PriorityTable`, `WebhookFeed` no se tocan estructuralmente — solo cambia el
  ordenamiento/prioridad visual de `AttentionQueue` según haya o no cola pendiente.

---

## 3. 4.3 — Audit completo por transición

Extender `buildEvents()` en `audit/page.tsx` con las siguientes ramas nuevas (mismo patrón que las
existentes: iterar sobre `leads`, generar un `AuditEvent` por condición):

- **`PIPELINE_ARCHIVED`:** cuando `lead.pipelineStage === "lost"` Y `lead.classification !==
  "spam"` (para no duplicar con el evento de auto-quarantine de spam ya existente). Severity INFO.
- **`PIPELINE_STAGE_CHANGE`:** cuando `lead.pipelineStage` está en `["contacted", "qualified",
  "won"]`. Severity INFO. Usa `reviewedAt`/`reviewedBy` si están presentes.
- **Rescore manual vs automático:** requiere un cambio pequeño en
  `apps/lead-scoring/src/app/api/leads/[id]/score/route.ts` (el endpoint que ya escribe a
  `scoreHistory` en modo `"pipeline"`, visto en Fase A al analizar "Test Rule Set") — cuando el
  rescore es disparado manualmente por un operador desde la UI (vs. automáticamente por el
  pipeline de ingesta), la entrada de `scoreHistory` debe llevar un `reason` que lo distinga (ej.
  `"manual rescore"` vs el reason que ya generan las otras rutas). `buildEvents()` lee ese `reason`
  para renderizar el evento como `INFERENCE_MANUAL` en vez de `INFERENCE` cuando corresponda, sin
  romper la rama existente que ya lee `scoreHistory`.
- **`DUPLICATE_DETECTED`:** cuando `lead.duplicateOf` está presente Y apunta a un id distinto del
  propio lead (ver sección 4 — tras el fix del bug de auto-referencia). Severity WARNING (requiere
  atención humana, no es solo informativo).

No se introduce un log persistido en servidor en esta fase — sigue siendo síntesis client-side,
consistente con la decisión ya tomada en Fase A.

---

## 4. 5.2 — Duplicados: de fusión automática a confirmación manual

### Cambio de comportamiento (aprobado explícitamente por el usuario)

En `finish-ingest.ts`, cuando `findDuplicate()` encuentra un match:

- **Ya no se fusiona automáticamente.** El nuevo lead se guarda como registro **separado y
  nuevo** (nuevo `id`, como cualquier ingesta normal), con `duplicateOf: existing.id` apuntando al
  lead **existente real** (fix del bug actual de auto-referencia a sí mismo).
- `attachIntelligence` deja de recibir `existing` para forzar el merge en esta ruta — el
  parámetro se sigue pasando (la función lo necesita para otros fines, ej. show de historial), pero
  la rama de "fusión in-place" (recalcular score promediado, mismo id) solo se ejecuta cuando el
  operador confirma el merge explícitamente vía la acción descrita abajo, no en el momento de
  ingesta.
- El log de tipo `"warn"` que ya se emite al stream de ingesta (`Duplicate of ${existing.id}`) se
  mantiene — sigue siendo información útil en tiempo real durante la ingesta.

### UI — banner + merge sugerido

- En la ficha del lead nuevo (donde sea que se muestre el detalle — `/leads/[id]` o el panel de
  detalle en `/leads`), si `duplicateOf` está presente: banner "Possible duplicate of {existing
  lead's name} (score {existing.score})" con link al lead existente.
- Botón "Merge into existing" en ese banner: abre una vista de comparación lado a lado (campos
  clave: score, tier, mensaje, budget, timeline, crmStatus) entre el lead nuevo y el existente.
- Solo al confirmar el merge desde esa vista se ejecuta la fusión real — reutilizando la lógica
  de recálculo que hoy vive en `attachIntelligence` (promediar score, etc.), movida/expuesta de
  forma que se pueda invocar bajo demanda desde un endpoint nuevo (ej.
  `POST /api/leads/[id]/merge` con `{ intoId: existing.id }`) en vez de solo en el momento de
  ingesta.
- Tras confirmar el merge: se genera el evento de audit `DUPLICATE_MERGED` (distinto de
  `DUPLICATE_DETECTED`), y el lead "perdedor" (el nuevo) queda archivado/eliminado según el mismo
  patrón que ya usa `deleteLeads`/`archiveLead`.

### Fuera de alcance de esta fase

No se construye un sistema de "posibles duplicados" retroactivo sobre leads ya existentes en el
desk (solo aplica a partir de nuevas ingestas tras este cambio). No se cambia el algoritmo de
matching de `findDuplicate()` (email/teléfono/company+name) — el roadmap pedía "dominio" pero el
comportamiento actual (company+name) es más preciso y se mantiene tal cual.

---

## 5. Rutas legacy (P2) — verificación, no-op

Confirmado: no existen archivos de ruta ni links rotos para `/triage`, `/scoring`,
`/automations`, `/integrations` (sin prefijo). No se requiere ningún cambio de código. Se
documenta como verificado, igual que se hizo con LEADS-P1-3 en Fase A. Si en el futuro aparece
evidencia externa (analytics, bookmarks) de que esas URLs se usaron alguna vez, se podría agregar
un `redirects()` defensivo en `next.config` — no se hace ahora sin esa evidencia.

---

## Fuera de alcance de Fase B (recordatorio)

Fase C (IA/enrichment: waterfall enrichment, smart next action, red flags, explicabilidad del
score) y Fase D (closed-loop/equipo) no se tocan en este spec. No se modifica ninguna otra app del
monorepo. No se commitea/pushea nada sin confirmación explícita del usuario (regla de `CLAUDE.md`
del repo).
