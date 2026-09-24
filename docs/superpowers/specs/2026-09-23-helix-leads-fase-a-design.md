# Helix for Leads — Fase A (Confianza del demo) — Design Spec

**Fecha:** 2026-09-23
**Fuente:** `HELIX-LEADS-ROADMAP-UNIFICADO.md` (Gemini + Helix Feedback), Fase A únicamente.
**Alcance:** LEADS-P0-1, LEADS-P1-1 + F-2, LEADS-P1-2, LEADS-P1-3 (verificación), 3.3.
**App:** `apps/lead-scoring` (Helix for Leads), monorepo `helix-lead-scoring-template`.

No tocar: `apps/commerce`, `apps/legal`, `apps/marketing`, ni el WIP sin commitear que ya existe
en el working tree (dejado intacto por decisión explícita del usuario).

---

## 1. LEADS-P0-1 — Estado HITL/CRM desincronizado tras Approve & Push

### Causa raíz (confirmada por lectura de código + agente Explore)

El bug no vive en un solo archivo. Es un patrón duplicado en **4 lugares del frontend** que
componen dos llamadas HTTP independientes sin transacción ni rollback:

1. `src/app/leads/page.tsx` → `pushCrm()` (~L422-440)
2. `src/app/inbox/page.tsx` → `act(id, "approve")` (~L120-141)
3. `src/components/leads-engine/TriageOverview.tsx` → `approveAndPush()` (~L92-104)
4. `src/components/lead-dashboard.tsx` → `sendCrm()` / `clearReview()` separados (~L321-353);
   riesgo latente si algún flujo futuro los encadena.

Los cuatro llaman `POST /api/leads/[id]/review` (limpia `needsReview: false`
**incondicionalmente**, `src/app/api/leads/[id]/review/route.ts` función `clear`) y luego
`POST /api/leads/[id]/crm`. Si el push falla:

- **Caso "mocked" (409, sin `GHL_API_KEY`/`GHL_LOCATION_ID`)**: `crm/route.ts` línea ~30-38
  retorna 409 **sin llamar `patchLead`** — `crmStatus` queda como estaba (`"not_sent"`).
- **Caso fallo real (502, GHL respondió error)**: línea ~64, mismo problema — tampoco se llama
  `patchLead`, y además se devuelve `lead: working` en el payload de error, que varios sitios del
  frontend tratan como si fuera un lead actualizado válido.

En ambos casos, `needsReview` ya quedó en `false` por el paso previo (`/review`), sin reversión.
El lead sale de la cola de HITL aunque el CRM nunca lo recibió.

Además: **no existe un audit log persistido en servidor**. `audit/page.tsx` sintetiza eventos en
cada render a partir de campos de `StoredLead` (`buildEvents()`, ~L45-140). Un evento `CRM_SYNC`
solo se genera si `crmStatus === "sent" | "mocked"` — un fallo de push no genera ninguna entrada,
ni de éxito ni de fallo.

Y: cada superficie (`inbox`, `analytics`, `audit`, badge del sidebar en `app-shell.tsx`) hace su
propio `fetch("/api/leads")` en momentos distintos (mount, cambio de `pathname`, evento custom
`helix:leads-refresh` que hoy solo escuchan `leads/page.tsx` y `TriageOverview.tsx`). No hay
invalidación compartida — de ahí que puedan mostrar contadores de "pending" distintos entre sí
en la misma sesión, incluso después de arreglar la causa raíz de arriba.

### Fix

**a) Tipo — añadir estado de fallo explícito**

En `packages/helix-core/src/types.ts`:

```ts
export type CrmStatus = "not_sent" | "mocked" | "sent" | "failed";
```

**b) Servidor — no perder el fallo, y no limpiar `needsReview` desde `/review` como paso ciego**

En `src/app/api/leads/[id]/crm/route.ts`, función `sendToCrm`:
- Si `result.mocked` → además del 409 actual, llamar `patchLead` con
  `crmStatus: "not_sent"` (config ausente, no es un intento fallido real) y dejar constancia via
  el mecanismo de audit (ver punto c).
- Si `result.ok` es `false` por error real (rama ~L61) → llamar `patchLead` con
  `crmStatus: "failed"`, guardando el motivo en un campo nuevo `crmError?: string` en
  `StoredLead` (junto a `ghlContactId`/`ghlOpportunityError`, mismo patrón).
- No cambiar la responsabilidad de `/review`: sigue siendo la operación explícita de "marcar
  como revisado por un humano", independiente del CRM. El problema no es que `/review` exista
  por separado — es que el **frontend** lo llama incondicionalmente antes de saber si el CRM
  confirmó.

**c) Frontend — invertir el orden en los 4 sitios: CRM primero, `/review` solo si el CRM confirma**

En cada uno de los 4 lugares (`leads/page.tsx`, `inbox/page.tsx`, `TriageOverview.tsx`, y el
llamador combinado si `lead-dashboard.tsx` alguna vez encadena ambos):

```
1. POST /crm
2. Si ok → POST /review (needsReview: false)
   Si falla → NO llamar /review. needsReview permanece true. Mostrar el error (toast/inline).
              El lead sigue correctamente en la cola HITL.
```

Esto satisface el criterio de aceptación #2 del roadmap ("Si el push falla: toast claro, lead
queda en cola o en retry, CRM not_sent/failed, y el badge refleja eso") sin inventar una cola de
retry nueva — "queda en cola" ya es el comportamiento correcto una vez que no se limpia
`needsReview` prematuramente.

**d) Audit — registrar el intento, éxito o fallo**

`audit/page.tsx` sigue siendo síntesis client-side (no se introduce un log persistido nuevo en
esta fase — sería una reestructuración mayor fuera de alcance de Fase A). Pero sí se puede hacer
honesto con los datos que ya existen:
- Añadir una rama en `buildEvents()`: si `lead.crmStatus === "failed"` → evento `CRM_SYNC_FAILED`
  (severity `WARNING`), usando el nuevo campo `crmError` como `targetSub`.
- Esto cumple el criterio #4 ("Audit log registra intento + resultado") dentro del modelo actual
  de audit derivado, sin construir un sistema de logging nuevo.

**e) Sincronización entre superficies — un solo evento, todos lo escuchan**

El evento `helix:leads-refresh` ya existe. Fix mínimo y coherente con el patrón ya establecido:
- Disparar `window.dispatchEvent(new CustomEvent("helix:leads-refresh"))` tras cada mutación
  relevante en los 4 sitios de approve/push, y en `sendCrm`/`clearReview` de `lead-dashboard.tsx`.
- Hacer que `app-shell.tsx` (badge sidebar), `analytics/page.tsx`, `audit/page.tsx`, e
  `inbox/page.tsx` **agreguen** un listener a ese evento (además de su fetch on-mount actual),
  igual que ya hacen `leads/page.tsx` y `TriageOverview.tsx`.

No se introduce polling ni una librería de data-fetching (SWR/React Query) — sería una
reestructuración mayor no pedida por el roadmap de Fase A. El evento custom ya es el patrón
existente en el código; esta fase solo lo extiende a las superficies que faltan.

### Criterios de aceptación (verificación)

1. Tras Approve con CRM offline/409/502: todas las superficies (inbox, analytics, audit, badge,
   dashboard, leads list) leen el mismo estado — 1 pending, nunca mixto. ✓ vía (c) + (e).
2. Push fallido → toast claro, lead permanece en cola, `crmStatus` en `not_sent`/`failed`, badge
   refleja eso. ✓ vía (b) + (c) + (e).
3. Push exitoso → `crmStatus: sent`, HITL cerrado en todas las superficies. ✓ vía (c) + (e)
   (ya funcionaba parcialmente; ahora es consistente en todos lados).
4. Audit registra intento + resultado (success/409/offline/failed). ✓ vía (d).

---

## 2. LEADS-P1-1 + F-2 — Una sola fuente de verdad para umbrales

### Causa raíz

`packages/helix-core/src/lead/heuristic.ts` línea ~150:

```ts
const needsReview = confidence < hitl || (score >= 40 && score <= 60);
```

`hitl` es un umbral de **confianza** (0-1, default 0.65, clamp 0.4-0.95 en `brain.ts`). La banda
`40-60` de score está **hardcoded** en el motor, sin relación con `hitl`.

La UI en `settings/scoring/page.tsx` muestra un slider "HITL %" (50-95, default 65) **etiquetado
como si fuera un umbral de score/puntos** ("Human Triage Band: {triageLo}–{triageHi} pts"), y
hardcodea además `autoQ = 80` y "`< 50` Auto-Disqualification" como constantes puramente
visuales, sin conexión al motor real.

`settings/automations/page.tsx` hardcodea de forma **completamente independiente**:
`matchesVip = score >= 90`, `matchesNurture = score entre 30-65`.

Resultado observado en QA: Ava (score 42) cae en HITL por la regla oculta `40-60` del motor, no
por el "umbral 65-79" que la UI de Scoring afirma. Tres fuentes de números, cero relación entre
ellas.

### Fix

**a) Extender `BrainSettings`** (`src/lib/brain.ts`) con los umbrales de score hoy hardcoded en
la UI:

```ts
export type BrainThresholds = {
  autoQualifyScore: number; // hoy 80, hardcoded en scoring/page.tsx
  dqScore: number;          // hoy 50, hardcoded en scoring/page.tsx
  vipScore: number;         // hoy 90, hardcoded en automations/page.tsx
  nurtureMin: number;       // hoy 30
  nurtureMax: number;       // hoy 65
};
```

Añadir a `BrainSettings`, `DEFAULT`, `getBrain()`, `setBrain()` siguiendo el mismo patrón que
`gates`/`automations` ya usan.

**b) Motor — leer de `getBrain()` en vez de constantes hardcoded**

`scoreLeadHeuristic` (heuristic.ts) recibe hoy solo `opts?.hitl`. Extender la firma para aceptar
los thresholds completos (o pasar el objeto `BrainSettings` completo, más simple):

```ts
const needsReview =
  confidence < hitl ||
  (score >= thresholds.dqScore + 1 && score < thresholds.autoQualifyScore); // banda visible, no 40-60 fijo
```

`applyBrainPolicies` (brain.ts) ya recibe `settings: BrainSettings` — cambiar sus condiciones
VIP/nurture hardcoded (`score >= 90`, `score entre 30-65`) para leer
`settings.thresholds.vipScore`, `settings.thresholds.nurtureMin/Max`.

**c) UI — eliminar constantes duplicadas, leer/escribir el mismo `/api/settings/brain`**

- `settings/scoring/page.tsx`: quitar `const autoQ = 80` y el DQ hardcoded del bloque "Auto-
  Disqualification"; leerlos de la respuesta de `/api/settings/brain` igual que ya hace con
  `hitl`. Guardar con `saveHitl()` extendido para incluir los 4 nuevos campos.
- `settings/automations/page.tsx`: quitar `matchesVip`/`matchesNurture` con números fijos;
  leerlos de `/api/settings/brain` (fetch ya existe en ese archivo) y usarlos en los `useMemo`.
- Aclarar en el copy de Scoring que el slider "HITL" es un umbral de **confianza**, no de score
  — evita que el usuario interprete mal el control como hace hoy.

**d) Criterio de aceptación explícito del roadmap**

"Un lead con score bajo el umbral DQ no entra a HITL" — se cumple automáticamente una vez que
`needsReview` se calcula desde los mismos `thresholds` que gobiernan DQ, en vez de la banda fija
`40-60` que hoy ignora el umbral DQ configurado.

### Fuera de alcance (decisión explícita, no omisión)

No se migra `disabledRuleIds`/pesos de categorías (Firmographic/Buyer/Intent/Tech) a una fuente
única en esta fase — el roadmap solo pide unificar los **umbrales de banda** (DQ/HITL/auto-
qualify/VIP/nurture), no el sistema completo de puntos por regla.

---

## 3. LEADS-P1-2 — Copy de connectors coherente

### Causa raíz

`src/app/settings/integrations/page.tsx` línea ~297: texto **hardcoded** `"1 CRM live"`,
mostrado sin importar el valor real de `ghl` (que sí se calcula correctamente en el resto de esa
misma página, ej. el badge "Operational"/"Offline" de la card de GHL). Mientras tanto
`/settings/page.tsx` calcula correctamente `"{connectedCount}/3 online"` desde `status.claude/
supabase/ghl`.

### Fix

Reemplazar la constante en `integrations/page.tsx`:

```tsx
<span className="rounded-full bg-surface-container px-2 py-0.5 font-mono text-[10px] text-on-surface-variant">
  {ghl ? "1 CRM live" : "0 CRM live"}
</span>
```

No se introduce un modelo de estado nuevo (online/configured/mock/offline) en esta fase — el
roadmap pide coherencia de copy, no un rediseño del modelo de conectores; el fix mínimo ya
elimina la contradicción reportada en QA ("0/3 online" vs "1 CRM live" en la misma sesión).

---

## 4. LEADS-P1-3 — `/settings` índice estable

### Verificación

`src/app/settings/page.tsx` existe (20KB, contenido completo, sin condicionales que puedan
lanzar 404). El 404 reportado el 16 Sep no reproduce en el código actual — no requiere fix de
código. Se documenta como **verificado**, sin cambios.

---

## 5. Ítem 3.3 — Undo toast con temporizador

### Diseño

En `src/app/inbox/page.tsx`, que ya maneja atajos `A`/`D` (~L82-88) y la función `act()`:

- Tras un `approve` que complete exitosamente el push a CRM (con el fix de la sección 1, esto ya
  solo ocurre cuando el CRM confirmó), mostrar un toast con:
  - Mensaje: "Approved & pushed to CRM — Ctrl+Z to undo (5s)"
  - Temporizador visual de 5s.
  - Si el usuario presiona `Ctrl+Z` dentro de la ventana: llamar a un nuevo endpoint (o reusar
    `PATCH` sobre `/review`) que revierte `needsReview: true`. Esto **no** revierte el push al
    CRM real (fuera de alcance — GHL ya recibió el contacto); el toast debe dejarlo claro en el
    texto si el undo solo afecta el estado de HITL en Helix, no el CRM.
- Aplica también al atajo `D` (archive) si el roadmap lo pide para paridad, pero el criterio
  explícito del roadmap (3.3) solo menciona proteger contra "pushes accidentales a CRM" — foco en
  el flujo de approve.

### Implementación mínima

- Estado local `pendingUndo: { id: string; timeoutId: number } | null` en `inbox/page.tsx`.
- Botón "Undo" en el toast + listener de `Ctrl+Z` mientras `pendingUndo` esté activo.
- Al expirar los 5s sin undo, limpiar el estado — no se requiere una cola de deshacer persistente
  ni multi-nivel.

---

## Fuera de alcance de Fase A (recordatorio)

Fase B (bulk triage audit, cola HITL first, duplicados), Fase C (IA/enrichment), Fase D
(closed-loop/equipo) — no se tocan en este spec. Tampoco se modifica ninguna otra app del
monorepo (`commerce`, `legal`, `marketing`) ni se commitea/pushea nada sin confirmación
explícita del usuario (regla de `CLAUDE.md` del repo).
