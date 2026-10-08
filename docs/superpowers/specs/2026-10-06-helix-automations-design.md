# Helix Automations — diseño

Estado: **borrador, sin aprobar** (2026-10-06). Nada de esto está implementado.
Piloto propuesto: Helix for Commerce. Confianza: media. Lo que no se verificó está marcado como *supuesto*.

## 1. Objetivo

Que cada Helix tenga una sección **Automations** donde el usuario:

1. ve las automatizaciones que su Helix ya trae ("Incluidas"),
2. crea las suyas hablando con Helix ("Tuyas"),
3. las revisa y edita en un canvas visual (estilo Zapier / Make / n8n) usando **solo las apps conectadas** a ese Helix,
4. ve qué se ejecutó y qué falló ("Historial").

Ejemplos: "Helix, mándame cada día a las 9 pm un resumen de las órdenes vendidas", "mándame por WhatsApp qué productos necesito comprar".

## 2. Principios (no negociables)

- **Juicio de IA separado de lógica determinista.** La IA solo traduce la frase a una `AutomationSpec` y, opcionalmente, redacta el tono. Validar, programar, consultar datos y enviar es código determinista.
- **El contenido sale de los datos, nunca de la IA.** "12 órdenes, $1,840" se cuenta; la lista de reposición sale de `restock.ts`. La IA no inventa cifras.
- **Nunca fallar en silencio.** Cada ejecución y cada fallo quedan en el historial y se notifican por un canal distinto al que falló.
- **Helix nunca dice "ya está" si no es verdad.** Una automatización es `active` solo si pasó la validación completa; si no, es `draft` y Helix dice qué falta.
- **Catálogo cerrado.** Solo existen los nodos que cada app declara. No hay nodos HTTP libres en v1 (evita SSRF y fugas de secretos).
- **La IA propone, el humano aprueba** cuando la acción toca a terceros o es irreversible.

## 3. Experiencia de usuario

### 3.1 Pantalla Automations (por app)

Tres bloques: **Incluidas en este Helix** (activar / pausar), **Tuyas** (creadas con Helix), **Historial** (última ejecución, próxima, error visible). Cada fila: nombre, estado, próxima ejecución, botón **Revisar**. Botón superior: **+ Nueva con Helix**.
Alternar vista **Lista / Canvas**.

### 3.2 Crear hablando con Helix

Tres resultados posibles; la respuesta de Helix depende del estado real, no de la intención.

**A. Todo conectado y válido → `active`.**
> Preparé tu seguimiento de órdenes: cada día a las 9:00 pm (hora de tu tienda) te envío por WhatsApp el número de órdenes, el total vendido y cuántas quedan en revisión. [Revisar automatización] · Si quieres añadir algo más, dímelo.

Siempre se enumera **exactamente** qué incluye el mensaje. Nunca "toda la información".

**B. Faltan conexiones o ajustes → `draft` (`needs_setup`).**
> Dejé tu automatización lista, pero para activarla necesito que conectes:
> • WhatsApp — [Conectar]
> • Zona horaria de la tienda — [Configurar]
> Cuando termines la activo y te aviso.

Cada fila lleva un botón **Conectar** que abre el flujo de conexión de esa herramienta (ver §6). Al volver, el validador corre de nuevo; si ya está completo, Helix pregunta "¿La activo?" (primera vez) o la activa (si el usuario lo pidió explícitamente).

**C. No se puede hacer → no se crea nada.** Helix explica el motivo (nodo inexistente, canal no soportado) y ofrece la alternativa más cercana.

### 3.3 Canvas

Vista del flujo de la automatización seleccionada: `Disparador → Datos → (IA) → (Aprobación) → Canal`. **v1: solo lectura + pausar / borrar / cambiar horario y canal.** El editor arrastrable (añadir pasos, ramas, esperas) es v2.
Tipos de nodo propios de Helix que no tienen las otras herramientas: **Requiere aprobación**, **Evidencia citada**, **Puerta de riesgo**.

## 4. Modelo de datos

```ts
type AutomationSpec = {
  id: string;
  orgId: string;               // multi-tenant
  name: string;
  origin: "builtin" | "user";
  status: "draft" | "active" | "paused" | "failed";
  missing: Requirement[];      // vacío si status = active
  trigger: { kind: "schedule"; cron: string; tz: string } | { kind: "event"; event: string };
  steps: Step[];               // ver catálogo
  createdBy: "chat" | "canvas" | "seed";
  createdAt: string;           // ISO
};

type Step =
  | { type: "source"; node: string; params: Record<string, unknown> }     // determinista
  | { type: "summarize"; node: string; ai?: { tone: string } }            // contenido determinista, IA solo redacta
  | { type: "gate"; risk: "low" | "medium" | "high" }                     // aprobación humana según riesgo
  | { type: "send"; channel: string; to: "self" | string };               // canal conectado

type Requirement =
  | { kind: "connection"; tool: string; connectUrl: string }
  | { kind: "setting"; key: string; settingsUrl: string }
  | { kind: "template"; channel: string; reason: string };

type AutomationRun = {
  id: string; automationId: string; scheduledFor: string;     // clave de idempotencia = automationId + scheduledFor
  status: "ok" | "failed" | "skipped" | "awaiting_approval";
  error?: string; startedAt: string; finishedAt?: string;
  output?: { summary: string };                               // lo que realmente se envió
};
```

Persistencia: Supabase (tablas `automations`, `automation_runs`, `connections`), con RLS por `org_id` como el resto del esquema. En demo, en memoria como los demás stores.

## 5. Validador previo (preflight)

Función pura `validateSpec(spec, catalog, connections, settings) → { ok, missing[] }`. Comprueba, sin llamar a la IA:

- cada nodo existe en el catálogo de esa app;
- cada canal está conectado y con credenciales vigentes;
- hay zona horaria si el disparador es de calendario;
- la plantilla de WhatsApp está aprobada si el envío es iniciado por el negocio;
- el destinatario tiene consentimiento (opt-in) registrado.

La respuesta del chat (A o B) se genera a partir de `missing[]`.

## 6. Conexiones: el botón "Conectar"

El botón lleva al flujo adecuado según el proveedor. **Estado real hoy** (según código y notas; *supuesto* donde se indica):

| Herramienta | Tipo de conexión | Estado actual |
|---|---|---|
| Gmail / Google Calendar | OAuth | Gmail OAuth real implementado en Inbox (nota 2026-09-20). Calendar: conector existe, *no probado de punta a punta*. |
| Shopify | OAuth (instalación de app) | Conector con webhooks en código; *no probado contra una tienda real*. |
| Meta (Instagram / Facebook) | OAuth | Hoy es un token en variable de entorno del servidor (un solo tenant). Conexión por usuario = trabajo nuevo + revisión de Meta. |
| LinkedIn | OAuth | Igual: token de entorno. |
| WhatsApp | Twilio (credenciales) o Meta Cloud API | No existe en Inbox ni Commerce. Twilio ya se usa en Real Estate. Plantillas aprobadas por Meta para mensajes iniciados por el negocio. |
| Slack | OAuth o webhook entrante | Hay un reporte semanal que publica en Slack (*no verificado cómo se configura*). |
| Resend (email) | Clave | Ya usada en Real Estate. |

Reglas del flujo:

1. **OAuth**: el botón abre la pantalla de autorización del proveedor (login con la cuenta del usuario); el callback guarda el token cifrado y devuelve al usuario a la automatización.
2. **Clave** (Twilio, Resend): el botón abre el formulario de claves de `@helix/help` con enlace a la documentación del proveedor.
3. Los tokens se guardan cifrados, por `org_id`, nunca se muestran de vuelta (ni siquiera enmascarados parcialmente).
4. Un botón **Probar conexión** ejecuta una llamada inofensiva y muestra el resultado real.

**Prerrequisito de seguridad:** `keysPostResponse` en `packages/helix-core/src/secrets.ts` hoy no exige la clave de operador, así que cualquiera puede guardar claves en la demo pública, y `maskSecret` devuelve 4+4 caracteres. Hay que cerrar eso **antes** de guardar conexiones de usuarios reales.

## 7. Ejecutor

- Un cron (cada pocos minutos) busca automatizaciones `active` con `scheduledFor <= now` y sin `AutomationRun` para esa clave. Así un reintento nunca duplica el envío.
- Cada paso devuelve un resultado tipado; un fallo marca el run `failed`, lo registra en auditoría y **notifica por otro canal** (campana en la app y, si existe, email).
- Reintentos acotados (p. ej. 3 con espera creciente); el fallo final es visible, nunca silencioso.
- *Supuesto a verificar:* la precisión y frecuencia de los crons depende del plan de Vercel (en el plan gratuito son poco frecuentes e imprecisos). No prometer "a las 9:00 en punto" hasta confirmarlo; mostrar al usuario la ventana real.

## 8. Riesgo y aprobación

| Acción | Riesgo | Comportamiento |
|---|---|---|
| Enviar resumen **al propio usuario** | bajo | Automático, con historial. |
| Enviar a terceros (clientes, equipo) | medio | Requiere aprobación al crear y muestra vista previa. |
| Acciones que modifican datos (cancelar orden, reordenar) | alto | Siempre pasan por la puerta de riesgo y aprobación humana en cada ejecución; con Undo cuando exista. |

Reutiliza `runWithPolicy` y el motor de `desk-actions` existentes.

## 9. Catálogo piloto: Commerce (v1)

- **Disparadores:** horario (cron + zona), orden nueva con riesgo alto, stock bajo.
- **Fuentes (deterministas):** órdenes vendidas hoy, órdenes en revisión, $ en riesgo, productos bajo punto de reorden y predicción de agotamiento.
- **Resumen:** plantilla con campos fijos; la IA solo ajusta el tono si el usuario lo pide.
- **Canales v1:** email (Resend) y Slack. **WhatsApp:** v1.1, cuando haya proveedor y plantilla aprobada. Con plantilla, el mensaje lleva un resumen corto y un enlace a la página (los listados largos no caben en variables de plantilla).
- **Incluidas (builtin):** resumen diario de ventas, aviso de stock bajo, órdenes de riesgo pendientes.

## 10. Fuera de alcance de v1

Editor arrastrable, ramas y esperas, nodos HTTP libres, automatizaciones que crucen apps (p. ej. correo de Inbox → lead en Leads), marketplace de plantillas, facturación por uso.

## 11. Riesgos y decisiones abiertas

1. **WhatsApp**: proveedor (Twilio vs Meta Cloud API), costo por conversación, plantillas y opt-in. Decisión de producto.
2. **Zona horaria**: por tienda (propuesto) o por usuario. Hoy no consta que Commerce la guarde.
3. **Cron**: plan de Vercel y precisión real.
4. **Multi-tenant de conexiones**: Meta/LinkedIn/X hoy son tokens de entorno; pasar a conexión por usuario es trabajo por proveedor.
5. **Seguridad de claves** (ver §6) como bloqueo previo.
6. **Dónde vive el código común**: `@helix/core` (spec, validador, ejecutor) y `@helix/ui` (lista y canvas); cada app solo declara su catálogo.

## 12. Plan por fases

1. **Fase 0 — cimientos:** cerrar el hueco de `keysPostResponse`; tabla `connections`; `AutomationSpec` + `validateSpec` con tests (sin UI).
2. **Fase 1 — Commerce, canal email/Slack:** ejecutor con idempotencia e historial; pantalla Automations (lista); Ask Helix crea el borrador/activa según §3.2; botón Conectar para Slack y Resend.
3. **Fase 2 — canvas de solo lectura** + pausar/editar horario.
4. **Fase 3 — WhatsApp** (cuando se resuelvan las decisiones abiertas).
5. **Fase 4 — replicar el catálogo** a Inbox, Leads y el resto.

## 13. Criterios de aceptación (v1)

- Pedir una automatización con todo conectado → queda `active`, y la respuesta enumera el contenido exacto.
- Pedirla con una conexión faltante → queda `draft`, la respuesta lista cada faltante con su botón, y no se ejecuta nada.
- Completar la conexión desde el botón → el validador corre de nuevo y la automatización se activa (o se pide confirmación).
- Una ejecución idéntica reintentada no envía dos veces.
- Un canal caído produce un run `failed` visible en el historial y una notificación por otro canal.
- Los números del resumen coinciden con los de las páginas de la app el mismo día (misma fuente de datos).
- Ninguna respuesta de Helix afirma "ya está" para una automatización `draft`.
- Los tokens no aparecen en ninguna respuesta de la API.
