# Helix for Leads — Fase A: qué se implementó

Resumen no técnico de lo hecho en la Fase A del roadmap (confianza del demo), según `HELIX-LEADS-ROADMAP-UNIFICADO.md`. Todo el trabajo quedó en la rama `feature/lead-scoring-template`, sin pushear ni tocar la rama principal.

## El bug más importante (LEADS-P0-1) — Estado desincronizado tras Approve & Push

- **El problema:** al aprobar un lead y enviarlo al CRM, si el envío fallaba (por ejemplo sin las API keys de GoHighLevel configuradas), el sistema igual lo marcaba como "revisado" — aunque el CRM nunca lo recibió. Distintas pantallas (inbox, analytics, audit, el contador del sidebar) mostraban números de pendientes distintos entre sí.
- **La causa:** el código marcaba "revisado" primero y recién después intentaba el envío al CRM. Si el envío fallaba, ya era tarde.
- **El arreglo:** se invirtió el orden — primero se intenta el CRM, y solo si tiene éxito se marca como revisado. Si falla, el lead queda correctamente en la cola de pendientes con el error visible.
- Se agregó un estado nuevo ("failed") para distinguir "nunca se envió" de "se intentó y falló", y ese fallo ahora sí queda registrado en el log de auditoría.
- Se sincronizaron todas las pantallas para que se actualicen juntas cuando cambia el estado de un lead.
- **Extendido tras revisión final:** se encontraron otros botones (archivar, re-calcular score, cambiar etapa, marcar spam) que también cambiaban el estado de un lead sin avisarle a las demás pantallas — se corrigió el mismo patrón ahí también.

## Umbrales de scoring unificados (LEADS-P1-1)

- **El problema original:** los números que decidían si un lead necesita revisión humana, se auto-califica, o se auto-descalifica estaban repetidos y desincronizados en 3 lugares del código.
- **El arreglo inicial:** se centralizaron en un solo lugar de configuración, editable desde la pantalla de Scoring.
- **Bug encontrado en la revisión final (ya corregido):** incluso con los umbrales unificados, un lead con score bajo (por debajo del umbral de descalificación) seguía cayendo en la cola de revisión humana — porque un segundo criterio interno ("confianza" del motor) tenía más peso del que debía. Este era exactamente el caso de QA que motivó el roadmap (el lead "Ava"). Se corrigió: ahora el umbral de score manda cuando el lead está claramente descalificado; el criterio de confianza solo aplica dentro de la banda ambigua o para evitar aprobar automáticamente leads de score alto con evidencia débil.

## Copy de conectores (LEADS-P1-2)

- La pantalla de Integrations ya no dice siempre "1 CRM live" — ahora refleja si GoHighLevel está realmente conectado o no.

## Verificación de /settings (LEADS-P1-3)

- Se confirmó que la página de Settings ya no da error 404. No hizo falta ningún cambio.

## Undo toast (ítem 3.3)

- Se agregó un aviso con temporizador de 5 segundos tras aprobar y enviar un lead con éxito, con botón "Undo" (y Ctrl+Z) para revertir la revisión si el operador se equivocó.
- Se corrigieron dos problemas encontrados en revisión: (1) si el operador aprobaba un segundo lead mientras el aviso del primero seguía visible, el primero desaparecía sin avisar — ahora se muestra un aviso de que esa ventana de undo se cerró; (2) el undo podía fallar en silencio (por ejemplo si había un problema de red) sin que el operador se enterara — ahora se muestra un error visible; y (3) presionar Ctrl+Z mientras se escribía una nota interfería con el "deshacer" normal del texto — ahora respeta el foco del cursor.
- El undo ahora también deja constancia en el historial del lead (quién y cuándo reabrió la revisión).

## Otro arreglo de la revisión final

- El mensaje de error real de un envío fallido al CRM ahora se guarda también en la base de datos (Supabase), no solo en memoria — antes se perdía y el log de auditoría mostraba "unknown error" en vez del motivo real.
- **Importante para cuando se despliegue:** este último cambio agrega una columna nueva a la base de datos (`crm_error`). Hay que aplicar esa migración en Supabase antes de subir este cambio a producción — el script ya está listo en el repo, solo falta ejecutarlo contra la base real.

## Cómo se trabajó

- Cada pieza se implementó, se probó y se revisó por separado antes de pasar a la siguiente.
- Al final se hizo una revisión de conjunto (mirando todo el trabajo junto, no pieza por pieza) que encontró el bug de scoring mencionado arriba y varios detalles más — todos ya corregidos.
- En el camino se descubrió que varios archivos de la app tenían versiones muy antiguas en el historial de git, mientras la versión real vivía sin guardar en la carpeta de trabajo. Se resolvió guardando ese trabajo previo tal cual estaba, y aplicando los cambios de esta fase encima, sin perder nada.
- Nada se subió (push) ni se mezcló con la rama principal.

## Fase B — también completa

Después de Fase A se hizo Fase B del roadmap (triaje power-user): acciones en lote (seleccionar varios leads y aprobar/archivar/borrar juntos, con confirmación y undo), vista previa al pasar el mouse sobre un lead, la cola de pendientes ahora aparece primero en el dashboard cuando hay algo que revisar, se corrigió que los duplicados se fusionaban solos sin avisar (ahora quedan separados y el merge es una acción explícita), se agregaron más eventos al log de auditoría (archivado, cambio de etapa, duplicado detectado), y se confirmó que las rutas viejas rotas no existen. Todo revisado tarea por tarea y en conjunto, sin hallazgos bloqueantes. Queda un pendiente menor documentado para cuando se construya la pantalla de comparación de duplicados (Task 5b), y la regresión ya conocida del botón "Test Rule Set" (que ahora crea leads duplicados en vez de reevaluar el mismo) sigue pendiente de decisión de producto.

## Estado final

Fase A y Fase B quedan **completas y cerradas**. Las 6 piezas del plan, la revisión final de conjunto, la ola de correcciones que salió de esa revisión, y la re-verificación de esas correcciones — todo revisado y en verde (89/89 tests, sin errores de tipo). Nada se subió (push) todavía; sigue todo en la rama `feature/lead-scoring-template`, a la espera de que decidas cuándo mergear.

## Qué queda pendiente (no bloqueante, para una próxima pasada)

- Al re-calcular el score de un lead ya aprobado (botón "Test Rule Set" / "Simulate on roster leads" en Settings → Scoring), el sistema puede reabrir la revisión humana de un lead que ya fue aprobado y enviado al CRM — convendría protegerlo para que no reabra leads ya cerrados.
- Los campos de umbral en la pantalla de Scoring no validan que el número de "auto-qualify" sea mayor al de "disqualify" — se puede dejar una configuración inconsistente sin aviso.
- Algunos números viejos quedaron hardcoded en lugares menores que no eran parte del alcance de esta fase (un diagrama decorativo, un filtro de la bandeja, un archivo de asignación de reps).
- Higiene de historial de git: dos de los commits de esta fase quedaron con contenido mezclado con trabajo previo no relacionado (no afecta el funcionamiento actual de la app, solo la trazabilidad del historial si алguien navega commit por commit más adelante).
