# Helix — Plan de fase 2 (resto) y evaluación de fase 3

**Fecha:** 30 sep 2026 · **Base:** `HELIX-ROADMAP-FASE-2-Y-3.md`

> Recordatorio honesto: el roadmap dice que no se empieza ningún Helix nuevo hasta cerrar phase one (todas las apps en 9/10). Este plan sigue adelante con la fase 2 porque así se decidió, pero los arreglos de honestidad de `HELIX-REVISION-30SEP.md` (tooltip con números inventados en Leads, "Claude 3.5 Sonnet Online" en Inbox, "Neural Matrix v4.2" en Legal, `gid://` en Commerce) siguen pendientes y son más baratos que cualquier app nueva.

## Estado de la fase 2

| App | Estado | Dónde |
|---|---|---|
| Real Estate | En curso (tú), Phase 0 | `apps/real-estate` |
| Social Media | **Base funcional hecha** (30 sep) | `apps/social-media`, `npm run dev:social` → puerto 43154 |
| Video | Planeado (abajo) | — |
| Health | Planeado (abajo) | — |

### Qué tiene ya Helix for Social Media

- **Marca de demo:** Lumen Roasters (tostador de café), 21 posts en 5 redes, colocados a partir de hoy para que la demo nunca se vea vieja.
- **Score "listo para aprobar" (0-100) con "Why this score?":** largo según la red, cantidad de hashtags, llamada a la acción, voz de marca (lista de palabras prohibidas) y brief visual. Revisa forma, no gusto. Dos bloqueos duros: pasarse del límite de la red o usar una palabra que la marca evita. Mientras haya un bloqueo, Approve está apagado.
- **HITL real desde el día uno:**
  - Aprobar siempre lo confirma una persona, tanto con el botón como desde Helix AI.
  - Devolver con nota, mover un borrador, agregar una nota y mandar a revisión corren solos y tienen Undo.
  - Mover un post ya aprobado pide confirmación.
- **Copy honesto:** "No social network is connected — nothing is posted from this desk". No hay métricas de engagement porque no existen. El KPI de aprobados dice "none published".
- **Pantallas:** Dashboard (KPIs con denominador explícito, cola de aprobación, mezcla por red y pilar, próximos 7 días), Calendar (5 semanas), Posts (filtros) con detalle, How to use.
- **Ask Helix AI:** asistente determinista en demo, Claude cuando hay key. Responde con links a los posts y usa el mismo motor de acciones y política de riesgo que Marketing.
- **Calidad:** 21 tests (score, asistente, acciones y Undo), typecheck limpio. El lint propio está limpio; quedan 4 avisos heredados del drawer y los eventos compartidos, que también tiene Real Estate.

### Siguiente en Social (Phase 1)

1. Editor de caption en el detalle del post, con el score recalculándose en vivo.
2. "Draft with Helix AI": generar el caption desde un brief y una red. Siempre entra como `draft` y nunca salta la cola.
3. Persistencia en Supabase (el patrón de las otras apps) y `HELIX_DESK_SEED=off` para un desk vacío.
4. Conectar redes, empezando por **una sola** (Meta: IG + FB comparten API). Publicar solo después de la aprobación, y el copy dice "published" solo cuando la API confirma.
5. Enlace con Marketing: qué posts empujaron leads (cuando haya datos reales, no antes).

## Helix for Video — plan

**Qué hace:** a partir de un video largo propone clips cortos, subtítulos, títulos y voz en off, y los deja listos para exportar.

**Riesgo principal:** es caro en tiempo y dinero (transcripción, render). El MVP no debe procesar video pesado en el servidor de Next.

| Fase | Alcance | Honestidad |
|---|---|---|
| 0 — Demo | Un video de muestra **ya transcrito** (JSON con timestamps). Helix propone 5–8 clips con "Why this clip?" (gancho en los primeros 3s, idea completa, duración por red, sin silencios largos). Títulos y subtítulos editables. | Badge "Sample video". No hay render real: se exporta un plan (EDL/JSON + SRT). |
| 1 — Transcripción real | Subir audio/video → transcripción (Whisper/API) en un job async con su estado. Límite de duración por plan. | Se muestra el costo estimado antes de procesar, y el operador confirma. |
| 2 — Render | Render de clips con Remotion (ya lo usamos en `helix-videos`) en un worker aparte o Lambda. | Render solo tras aprobar el clip. |
| 3 — Voz en off | TTS opcional por clip. | Etiqueta "AI voice" visible en el export. |

**HITL:** aprobar un clip para render pide confirmación (gasta dinero). Ajustar el inicio y el fin o editar el título va solo, con Undo.
**Sinergia:** los clips aprobados pueden caer como borradores en Social Media.
**Estimado MVP (fase 0):** 3–4 días con el patrón actual.

## Helix for Health — plan

**Qué hace:** admisión (intake), recordatorios, seguimientos y preguntas frecuentes con aprobación.

**Regla de oro:** nada de diagnóstico ni consejo médico. Helix organiza y redacta; una persona del equipo clínico aprueba todo lo que sale hacia el paciente.

| Fase | Alcance | Cumplimiento |
|---|---|---|
| 0 — Demo | Clínica de muestra con pacientes **ficticios** (nombres claramente inventados). Bandeja de intake con un score de "completitud" (faltan seguro, alergias, consentimiento…), recordatorios propuestos y FAQ con respuestas borrador. | Sin PHI real. Banner "Demo — fictional patients". |
| 1 — Piloto | Formularios de intake reales, plantillas de recordatorio, cola de aprobación. | **Antes de PHI real:** BAA con cada proveedor (hosting, DB, LLM, SMS/email), cifrado en reposo, logs de acceso, retención definida. Sin BAA con el proveedor del LLM, el texto del paciente no se le envía. |
| 2 — Envíos | SMS/email de recordatorio tras aprobación. | Opt-in del paciente y opción de baja en cada mensaje. |

**HITL:** todo mensaje al paciente pide confirmación, sin excepciones y sin auto-run. Marcar un intake como completo o agregar notas internas va solo, con Undo.
**Decisión pendiente tuya:** ¿hay clientes en EE.UU. (HIPAA) o primero LATAM (leyes locales de datos personales)? Esto cambia los proveedores.
**Estimado MVP (fase 0):** 3 días. El piloto depende de los contratos (BAA), no del código.

## Orden recomendado

1. Cerrar los arreglos de honestidad de phase one (≈1 día en total).
2. Real Estate Phase 0 → 1 (tú, en curso).
3. Social Media Phase 1, puntos 1–3 (editor, draft con IA, persistencia).
4. Video fase 0 (demo con transcripción fija). Comparte marca de demo con Social para que la historia sea una sola.
5. Health fase 0 solo cuando esté decidido el mercado (EE.UU. o LATAM).

## Fase 3 — evaluación (no se construye todavía)

El roadmap pide validar con prospectos reales antes de elegir. Esto es lo que sé desde el código, sin datos de mercado:

| Candidato | Reuso de lo que ya existe | Riesgo | Señal a buscar con prospectos |
|---|---|---|---|
| **Support** | Muy alto: es Inbox + base de conocimiento + escalamiento. | Bajo | ¿Ya pagan Zendesk/Intercom y les molesta la calidad de las respuestas? |
| **Talent** | Alto: lead scoring → candidato scoring, mismo patrón "Why this?". | Medio (sesgo y discriminación: el score no puede usar edad, género, etc.) | ¿Cuántos CVs por vacante? ¿Quién filtra hoy? |
| **Research** | Medio: Ask AI con fuentes citadas (`citeSpan` en `@helix/core`). | Medio (alucinación: cada dato con fuente) | ¿Pagan reportes o analistas? |
| **Books** | Bajo: conciliación es un dominio nuevo. | Alto (errores contables cuestan dinero) | ¿Qué software usan? ¿Exporta CSV? |
| **Voice** | Bajo: telefonía y tiempo real son otra pila. | Alto (latencia, costo por minuto) | ¿Volumen de llamadas? ¿Qué se pierde hoy? |
| **Edit** | Medio: drawer + propuestas sobre texto largo. | Bajo | Difícil diferenciarse de ChatGPT/Docs. Necesita un nicho (contratos, manuales). |

**Mi recomendación:** Support primero (casi todo existe ya en Inbox), Talent segundo. Antes de escribir código:
1. Hacer 5 llamadas por candidato con prospectos reales.
2. Preguntar qué usan hoy, cuánto pagan y qué aprobarían a mano.
3. Elegir el que tenga más "lo pagaría ya".

Voice y Books se quedan para cuando haya un cliente concreto que los pida.

## Checklist por app nueva (para no repetir errores de la fase 1)

- [ ] Demo con nombres que no se repiten entre desks.
- [ ] Ningún KPI sin denominador explícito, y ningún número que no salga de los datos.
- [ ] Ningún "live", "synced" ni "published" sin que la integración lo confirme.
- [ ] Ningún nombre de modelo ni "neural engine" en la UI.
- [ ] Toda acción que sale del desk (publicar, enviar, gastar) siempre pide confirmación.
- [ ] Undo en todo lo que corre solo.
- [ ] Tests de score, asistente y acciones antes de la primera demo.
