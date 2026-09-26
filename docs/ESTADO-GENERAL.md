# Estado general — Helix for Leads (Fase A + B) y Helix Inbox (en diseño)

## Helix for Leads — completo, ambas fases cerradas

### Fase A (confianza del demo) — cerrada
- Se arregló el bug crítico: aprobar y enviar un lead al CRM marcaba el lead como "resuelto" aunque el envío fallara. Ahora primero confirma el CRM, después marca como revisado.
- Umbrales de scoring unificados en un solo lugar (antes vivían repetidos en 3 sitios distintos y se contradecían).
- Se corrigió el copy de conectores ("1 CRM live" ya refleja el estado real).
- Se agregó un aviso de "deshacer" (5 segundos) tras aprobar y enviar un lead, con manejo correcto de fallos silenciosos.
- Verificado: rutas viejas rotas (`/triage`, `/scoring`, etc.) no existen en el código actual.
- Revisión final de conjunto: aprobada, sin hallazgos bloqueantes.

### Fase B (triaje power-user) — cerrada
- Selección múltiple de leads con acciones en lote (aprobar, archivar, borrar) + confirmación + deshacer.
- Vista previa al pasar el mouse sobre un lead en la lista.
- La cola de leads pendientes de revisión ahora aparece primero en el dashboard cuando hay algo pendiente (antes competía visualmente con las métricas).
- Se corrigió que los duplicados se fusionaban solos y en silencio — ahora quedan como registros separados, y la fusión real requiere una acción explícita de un operador (nuevo endpoint de merge).
- Se agregaron más eventos al registro de auditoría (archivado, cambio de etapa, duplicado detectado).
- Revisión final de conjunto: aprobada, con un hallazgo menor documentado (un campo de error de CRM podría no limpiarse del todo al fusionar duplicados — bajo impacto, pendiente para cuando se construya la pantalla de comparación de duplicados).

### Pendientes conocidos (no bloqueantes, quedaron documentados)
- El botón "Test Rule Set" en Configuración → Scoring ahora crea un lead duplicado cada vez que se usa, en vez de recalcular el mismo lead — necesita una decisión de producto sobre qué debe simular exactamente ese botón.
- Falta construir la pantalla de comparación lado a lado para confirmar la fusión de duplicados (hoy el endpoint existe pero ninguna pantalla lo usa todavía).
- Nada de esto se subió (push) a ningún repositorio remoto — todo el trabajo está en la rama de trabajo local, a la espera de que decidas cuándo publicarlo.

---

## Helix Inbox — en diseño, investigación completa

Pediste priorizar dos features nuevas para Helix Inbox: (1) una cola de seguimiento automático cuando un correo enviado no recibe respuesta en 2 días hábiles, y (2) un panel que muestre por qué el agente decidió algo (clasificación, confianza, fuentes citadas de una base de conocimiento).

### Lo que se investigó del código actual
- La integración con Gmail **ya es real** (no es una demo simulada): login, lectura de la bandeja, y envío de respuestas dentro del mismo hilo, todo funcional.
- Los borradores de respuesta y la cola de aprobación humana **ya existen y funcionan** — no hay que construirlos de nuevo, solo extenderlos.
- La carga de archivos `.eml` sueltos **no existe** en ningún lugar del proyecto — hay que construirla desde cero.
- Hoy, cuando se envía una respuesta, el sistema no guarda un registro de "esto fue lo último que respondimos" — solo cambia el estado del hilo a "enviado". Esto hay que arreglarlo primero, porque sin eso no se puede calcular con precisión "sin respuesta hace 2 días hábiles".
- Ya existe en otra parte del sistema (usada en Helix Legal) un motor de búsqueda de texto sencillo con citas exactas — es reutilizable para la base de conocimiento en Markdown, en vez de construir uno nuevo desde cero.
- El panel de razonamiento del agente no existe todavía en Inbox — es una pieza completamente nueva.

### Decisiones que ya tomaste
1. Se usará la integración real de Gmail desde el principio (no una demo previa con datos falsos).
2. Sí se incluye la carga de archivos `.eml` en el alcance de este trabajo.
3. Zona horaria por defecto para el cálculo de "2 días hábiles": hora del Este de EE.UU. (US Eastern), como proponía el documento original.
4. Se arregla primero el registro de "última respuesta enviada" como parte de este mismo trabajo, no aparte.

### Qué falta antes de empezar a programar
- Terminar de definir con vos un par de detalles más del diseño (ej. cómo se ve exactamente el panel de razonamiento, qué pasa si sube un `.eml` de un hilo que ya existe).
- Escribir el documento de diseño técnico completo (spec) y que lo apruebes.
- Armar el plan de implementación paso a paso.
- Recién ahí empieza la programación.
