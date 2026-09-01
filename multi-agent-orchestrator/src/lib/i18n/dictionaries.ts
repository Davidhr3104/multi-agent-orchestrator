export type Lang = "es" | "en";

export const LANGS: Lang[] = ["es", "en"];

export const dictionaries = {
  es: {
    "nav.dashboard": "Dashboard",
    "nav.workflows": "Workflows",
    "nav.agents": "Agents",
    "nav.logs": "Logs",
    "nav.permissions": "Permisos",
    "nav.run": "Correr Pipeline",
    "nav.running": "Orquestando…",

    "common.backToDashboard": "← Ir al Dashboard",
    "common.language": "Idioma",

    "dashboard.kicker": "Proyecto #1 · análisis de contenido",
    "dashboard.kickerRunning": "Iniciando secuencia de análisis",
    "dashboard.title1": "Seis agentes, un orquestador,",
    "dashboard.title2": "cero cajas negras.",
    "dashboard.subtitle":
      "Extrae con evidencia, puntúa SEO, verifica claims sin inventar fuentes y recomienda acciones. El revisor audita a sus pares. Si la confianza baja, entra un humano.",
    "dashboard.briefLabel": "Brief o artículo",
    "dashboard.restoreSample": "Restaurar ejemplo",
    "dashboard.urlLabel": "URL de Origen",
    "dashboard.urlPlaceholder": "https://ejemplo.com/doc-tecnico...",
    "dashboard.contentLabel": "Contexto del Documento",
    "dashboard.contentPlaceholder":
      "Pegue el contenido raw o el JSON estructurado aquí...",
    "dashboard.consoleTitle": "Consola en vivo",
    "dashboard.consoleTip":
      "Tip: en Permisos apaga Verificación y sube el umbral HITL. El log SSE debe mostrar skip + campos con evidencia.",
    "dashboard.agentMeshTitle": "Malla de Agentes",
    "dashboard.tabTimeline": "Timeline",
    "dashboard.tabResult": "Resultado",
    "dashboard.emptyTimelineTitle": "Todavía no hay corrida",
    "dashboard.emptyTimelineDesc":
      "Pulsa Correr Pipeline para ver extracción, SEO, verificación y el checkpoint humano con confidence por campo.",
    "dashboard.emptyResultTitle": "Sin paquete consolidado",
    "dashboard.emptyResultDesc":
      "El orquestador llena esta vista cuando termina: campos, claims, reviews y firma humana.",
    "dashboard.sheetTitle": "Permisos y umbrales",
    "dashboard.sheetDesc":
      "Activa o apaga cada agente. Confianza mínima 0.70 y HITL 0.85 por defecto.",

    "controlPanel.agentsTitle": "Agentes",
    "controlPanel.agentsDesc":
      "Apaga un agente para saltarlo. Extractor y orquestador son requeridos para una corrida completa.",
    "controlPanel.minConfidence": "Confianza mínima",
    "controlPanel.minConfidenceHint": "Por debajo: el agente queda bloqueado.",
    "controlPanel.hitl": "Umbral HITL",
    "controlPanel.hitlHint":
      "Por debajo: requiere revisión humana. Default 0.85.",

    "agentBoard.status.idle": "En cola",
    "agentBoard.status.running": "En ejecución",
    "agentBoard.status.done": "Completado",
    "agentBoard.status.skipped": "Omitido (bypass)",
    "agentBoard.status.blocked": "Bloqueado",

    "logStream.title": "Consola en vivo",
    "logStream.waitingTitle": "SSE en espera",
    "logStream.waitingDesc":
      "Cada acción llega por Server-Sent Events: timestamp, agente, campo, confidence y evidencia.",
    "logStream.field": "campo",
    "logStream.conf": "conf",

    "resultDashboard.timeTotal": "Tiempo Total",
    "resultDashboard.activeAgents": "Agentes Activos",
    "resultDashboard.stepsCompleted": "Pasos Completados",
    "resultDashboard.avgConfidence": "Confianza (Avg)",
    "resultDashboard.tableAgent": "Agente",
    "resultDashboard.tableDecision": "Decisión",
    "resultDashboard.tableConf": "Conf.",
    "resultDashboard.tableSummary": "Resumen",
    "resultDashboard.chipMin": "min",
    "resultDashboard.chipHitl": "HITL",
    "resultDashboard.exportJson": "JSON",
    "resultDashboard.exportPdf": "PDF",

    "resultPanel.source": "Fuente",
    "resultPanel.hitlTitle": "Intervención Humana Requerida (HITL)",
    "resultPanel.hitlDesc":
      "{count} campo(s) por debajo del umbral. Confirma antes de tratar este paquete como publicable.",
    "resultPanel.sign": "Firmar paquete",
    "resultPanel.signed": "Paquete firmado",
    "resultPanel.missingConfirmations": "Faltan {count} confirmaciones",
    "resultPanel.approve": "Aprobar este valor manualmente",
    "resultPanel.evidence": "Evidencia",
    "resultPanel.fieldsTitle": "Campos Extraídos",
    "resultPanel.claimsTitle": "Claims & Notas",
    "resultPanel.noClaims":
      "Sin claims: verificación deshabilitada o sin permisos.",
    "resultPanel.recommendationsTitle": "Recomendaciones del Agente",
    "resultPanel.reviewsTitle": "Revisión entre agentes",
    "resultPanel.confidenceLabel": "confianza",

    "decision.aprobado": "aprobado",
    "decision.requiere revisión": "requiere revisión",
    "decision.bloqueado": "bloqueado",

    "footer.version": "Helix Orchestrator v2.4.0",
    "footer.docs": "Documentation",
    "footer.support": "Support",
    "footer.status": "System Status",

    "permission.read_input": "Leer input",
    "permission.fetch_url": "Fetch de URL",
    "permission.write_structured": "Escribir campos",
    "permission.analyze_seo": "Analizar SEO",
    "permission.verify_claims": "Verificar hechos",
    "permission.write_recommendations": "Escribir recomendaciones",
    "permission.peer_review": "Revisión entre agentes",
    "permission.request_human": "Escalar a humano",

    "agent.orchestrator.name": "Orquestador",
    "agent.orchestrator.role": "Clasifica el input, arma el flujo y consolida el resultado.",
    "agent.orchestrator.detail":
      "Clasifica el input como url, article o copy, decide si autoriza el fetch de una URL, ordena el grafo (extractor → SEO ∥ verificación → revisor → recomendador → revisor → consolidar) y calcula la confianza global al final de la corrida.",
    "agent.extractor.name": "Extractor",
    "agent.extractor.role": "Campos con evidencia y confidence score.",
    "agent.extractor.detail":
      "Estructura título, audiencia, keywords, tono y extensión a partir del texto normalizado. Cada campo trae su propio confidence score y una cita textual como evidencia.",
    "agent.seo.name": "Calidad / SEO",
    "agent.seo.role": "Legibilidad, keywords y huecos de contenido.",
    "agent.seo.detail":
      "Corre en paralelo con Verificación. Calcula legibilidad, densidad de palabras y si la keyword principal aparece en el lead; devuelve además una meta description sugerida.",
    "agent.factcheck.name": "Verificación",
    "agent.factcheck.role": "Claims soportadas o sin fuente. No inventa.",
    "agent.factcheck.detail":
      "Separa oraciones con cifras o afirmaciones fuertes y las marca como supported (citan fuente), unverified (sin fuente) o conflicted. Nunca inventa una fuente que no existe en el texto.",
    "agent.recommender.name": "Recomendaciones",
    "agent.recommender.role": "Acciones priorizadas sobre métricas reales.",
    "agent.recommender.detail":
      "Lee los outputs de extractor, SEO y verificación —nunca calcula sus propios números— y prioriza hasta 5 acciones accionables en alta, media o baja prioridad.",
    "agent.reviewer.name": "Revisor cruzado",
    "agent.reviewer.role": "Un agente revisa a otro: aprueba, corrige o bloquea.",
    "agent.reviewer.detail":
      "Corre dos veces: primero sobre extractor, SEO y verificación; luego sobre el recomendador. Emite approve, revise o block por cada agente que evalúa (agent-reviewing-agent).",

    "agentsPage.kicker": "Catálogo",
    "agentsPage.title": "Agentes del sistema",
    "agentsPage.subtitle":
      "Seis agentes especializados, cada uno con permisos granulares propios. Actívalos, desactívalos o ajusta los umbrales desde el panel de Permisos en el Dashboard.",
    "agentsPage.defaultPerms": "Permisos por defecto",
    "agentsPage.noDefaultPerms": "Sin permisos por defecto",

    "workflowsPage.kicker": "Definición del pipeline",
    "workflowsPage.title": "Content Intelligence Pipeline",
    "workflowsPage.subtitle":
      "Un único workflow, siete pasos, con una rama en paralelo y una revisión cruzada que corre dos veces. Los permisos y umbrales (confianza mínima 0.70, HITL 0.85 por defecto) se configuran en el Dashboard y afectan directamente qué pasos se saltan o bloquean.",
    "workflowsPage.step1.title": "1. Clasificación",
    "workflowsPage.step1.detail":
      "El orquestador decide si el input es url, article o copy (según longitud del texto o si llegó una URL) y arma el orden del grafo según ese tipo.",
    "workflowsPage.step1.meta": "Orquestador",
    "workflowsPage.step2.title": "2. Extracción",
    "workflowsPage.step2.detail":
      "El extractor construye 5 campos (título, audiencia, keywords, tono, extensión), cada uno con su propio confidence score y una cita como evidencia.",
    "workflowsPage.step2.meta": "Extractor",
    "workflowsPage.step3.title": "3. SEO y Verificación en paralelo",
    "workflowsPage.step3.detail":
      "SEO calcula legibilidad y densidad de keywords; Verificación separa afirmaciones en supported / unverified / conflicted. Corren al mismo tiempo y cada uno respeta sus propios permisos.",
    "workflowsPage.step3.meta": "Calidad / SEO · Verificación",
    "workflowsPage.step4.title": "4. Revisión cruzada (pase 1)",
    "workflowsPage.step4.detail":
      "El revisor evalúa extractor, SEO y verificación. Emite approve, revise o block por cada uno — agent-reviewing-agent.",
    "workflowsPage.step4.meta": "Revisor cruzado",
    "workflowsPage.step5.title": "5. Recomendaciones",
    "workflowsPage.step5.detail":
      "El recomendador lee los outputs anteriores (nunca calcula sus propios números) y prioriza hasta 5 acciones en alta / media / baja prioridad.",
    "workflowsPage.step5.meta": "Recomendaciones",
    "workflowsPage.step6.title": "6. Revisión cruzada (pase 2)",
    "workflowsPage.step6.detail":
      "El revisor vuelve a correr, esta vez sobre el recomendador, y actualiza su resumen de decisiones.",
    "workflowsPage.step6.meta": "Revisor cruzado",
    "workflowsPage.step7.title": "7. Consolidación",
    "workflowsPage.step7.detail":
      "El orquestador promedia la confianza de los agentes que terminaron, decide si se requiere HITL (campo por debajo del umbral o confianza global baja) y narra el resultado con Claude si hay API key configurada.",
    "workflowsPage.step7.meta": "Orquestador",
    "workflowsPage.inputKindsTitle": "Tipos de input y cómo cambian el flujo",
    "workflowsPage.kind.url.label": "url",
    "workflowsPage.kind.url.detail":
      "Llega una URL pública. El orquestador hace fetch (si tiene el permiso fetch_url) y convierte el HTML a texto antes de seguir.",
    "workflowsPage.kind.article.label": "article",
    "workflowsPage.kind.article.detail":
      "Texto de 280+ caracteres sin URL. Flujo completo: SEO evalúa profundidad y estructura de H2/H3 implícita.",
    "workflowsPage.kind.copy.label": "copy",
    "workflowsPage.kind.copy.detail":
      "Texto corto (<280 caracteres). La audiencia se infiere como 'visitante de landing' y las recomendaciones priorizan el hook inicial.",
    "workflowsPage.thresholdsTitle": "Umbrales que gobiernan las decisiones",
    "workflowsPage.minConfTitle": "Confianza mínima — 0.70",
    "workflowsPage.minConfDetail":
      "Si un agente termina por debajo de este valor, su decisión pasa a \"bloqueado\" en el dashboard de resultados.",
    "workflowsPage.hitlTitle": "Umbral HITL — 0.85",
    "workflowsPage.hitlDetail":
      "Por debajo de este valor, un campo queda marcado needsHuman y el paquete requiere firma humana antes de publicarse.",

    "logsPage.kicker": "Auditoría",
    "logsPage.title": "Logs persistidos",
    "logsPage.subtitle":
      "Cada corrida que pasa por Supabase queda aquí, agrupada por run_id, con timestamp, agente, campo, confidence y evidencia — exactamente lo que se ve en la consola en vivo del Dashboard, pero persistido.",
    "logsClient.loading": "Cargando…",
    "logsClient.disabledTitle": "Persistencia deshabilitada",
    "logsClient.disabledDesc":
      "Configura NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY para guardar cada corrida. Mientras tanto, la consola en vivo del Dashboard sigue funcionando por SSE durante una corrida activa.",
    "logsClient.noRunsTitle": "Sin corridas registradas",
    "logsClient.noRunsDesc":
      "Corre el pipeline en el Dashboard; cada log queda persistido aquí automáticamente por run_id.",
    "logsClient.refresh": "Actualizar",
  },
  en: {
    "nav.dashboard": "Dashboard",
    "nav.workflows": "Workflows",
    "nav.agents": "Agents",
    "nav.logs": "Logs",
    "nav.permissions": "Permissions",
    "nav.run": "Run Pipeline",
    "nav.running": "Orchestrating…",

    "common.backToDashboard": "← Back to Dashboard",
    "common.language": "Language",

    "dashboard.kicker": "Project #1 · content analysis",
    "dashboard.kickerRunning": "Starting analysis sequence",
    "dashboard.title1": "Six agents, one orchestrator,",
    "dashboard.title2": "zero black boxes.",
    "dashboard.subtitle":
      "Extracts with evidence, scores SEO, verifies claims without inventing sources, and recommends actions. The reviewer audits its peers. If confidence drops, a human steps in.",
    "dashboard.briefLabel": "Brief or article",
    "dashboard.restoreSample": "Restore sample",
    "dashboard.urlLabel": "Source URL",
    "dashboard.urlPlaceholder": "https://example.com/tech-doc...",
    "dashboard.contentLabel": "Document content",
    "dashboard.contentPlaceholder":
      "Paste raw content or structured JSON here...",
    "dashboard.consoleTitle": "Live console",
    "dashboard.consoleTip":
      "Tip: in Permissions, turn off Fact-check and raise the HITL threshold. The SSE log should show a skip + fields with evidence.",
    "dashboard.agentMeshTitle": "Agent Mesh",
    "dashboard.tabTimeline": "Timeline",
    "dashboard.tabResult": "Result",
    "dashboard.emptyTimelineTitle": "No run yet",
    "dashboard.emptyTimelineDesc":
      "Press Run Pipeline to see extraction, SEO, fact-check, and the human checkpoint with per-field confidence.",
    "dashboard.emptyResultTitle": "No consolidated package",
    "dashboard.emptyResultDesc":
      "The orchestrator fills this view when it finishes: fields, claims, reviews, and human sign-off.",
    "dashboard.sheetTitle": "Permissions & thresholds",
    "dashboard.sheetDesc":
      "Turn each agent on or off. Minimum confidence 0.70 and HITL 0.85 by default.",

    "controlPanel.agentsTitle": "Agents",
    "controlPanel.agentsDesc":
      "Turn off an agent to skip it. Extractor and orchestrator are required for a full run.",
    "controlPanel.minConfidence": "Minimum confidence",
    "controlPanel.minConfidenceHint": "Below this: the agent is blocked.",
    "controlPanel.hitl": "HITL threshold",
    "controlPanel.hitlHint":
      "Below this: requires human review. Default 0.85.",

    "agentBoard.status.idle": "Queued",
    "agentBoard.status.running": "Running",
    "agentBoard.status.done": "Completed",
    "agentBoard.status.skipped": "Skipped (bypass)",
    "agentBoard.status.blocked": "Blocked",

    "logStream.title": "Live console",
    "logStream.waitingTitle": "SSE standing by",
    "logStream.waitingDesc":
      "Every action arrives via Server-Sent Events: timestamp, agent, field, confidence, and evidence.",
    "logStream.field": "field",
    "logStream.conf": "conf",

    "resultDashboard.timeTotal": "Total Time",
    "resultDashboard.activeAgents": "Active Agents",
    "resultDashboard.stepsCompleted": "Steps Completed",
    "resultDashboard.avgConfidence": "Confidence (Avg)",
    "resultDashboard.tableAgent": "Agent",
    "resultDashboard.tableDecision": "Decision",
    "resultDashboard.tableConf": "Conf.",
    "resultDashboard.tableSummary": "Summary",
    "resultDashboard.chipMin": "min",
    "resultDashboard.chipHitl": "HITL",
    "resultDashboard.exportJson": "JSON",
    "resultDashboard.exportPdf": "PDF",

    "resultPanel.source": "Source",
    "resultPanel.hitlTitle": "Human Intervention Required (HITL)",
    "resultPanel.hitlDesc":
      "{count} field(s) below threshold. Confirm before treating this package as publishable.",
    "resultPanel.sign": "Sign package",
    "resultPanel.signed": "Package signed",
    "resultPanel.missingConfirmations": "{count} confirmations missing",
    "resultPanel.approve": "Approve this value manually",
    "resultPanel.evidence": "Evidence",
    "resultPanel.fieldsTitle": "Extracted Fields",
    "resultPanel.claimsTitle": "Claims & Notes",
    "resultPanel.noClaims":
      "No claims: fact-check disabled or missing permissions.",
    "resultPanel.recommendationsTitle": "Agent Recommendations",
    "resultPanel.reviewsTitle": "Cross-agent review",
    "resultPanel.confidenceLabel": "confidence",

    "decision.aprobado": "approved",
    "decision.requiere revisión": "needs review",
    "decision.bloqueado": "blocked",

    "footer.version": "Helix Orchestrator v2.4.0",
    "footer.docs": "Documentation",
    "footer.support": "Support",
    "footer.status": "System Status",

    "permission.read_input": "Read input",
    "permission.fetch_url": "Fetch URL",
    "permission.write_structured": "Write fields",
    "permission.analyze_seo": "Analyze SEO",
    "permission.verify_claims": "Verify claims",
    "permission.write_recommendations": "Write recommendations",
    "permission.peer_review": "Cross-agent review",
    "permission.request_human": "Escalate to human",

    "agent.orchestrator.name": "Orchestrator",
    "agent.orchestrator.role": "Classifies the input, builds the flow, and consolidates the result.",
    "agent.orchestrator.detail":
      "Classifies the input as url, article, or copy, decides whether to authorize fetching a URL, orders the graph (extractor → SEO ∥ fact-check → reviewer → recommender → reviewer → consolidate), and computes overall confidence at the end of the run.",
    "agent.extractor.name": "Extractor",
    "agent.extractor.role": "Fields with evidence and confidence score.",
    "agent.extractor.detail":
      "Structures title, audience, keywords, tone, and length from the normalized text. Each field carries its own confidence score and a textual quote as evidence.",
    "agent.seo.name": "Quality / SEO",
    "agent.seo.role": "Readability, keywords, and content gaps.",
    "agent.seo.detail":
      "Runs in parallel with Fact-check. Computes readability, word density, and whether the main keyword appears in the lead; also returns a suggested meta description.",
    "agent.factcheck.name": "Fact-check",
    "agent.factcheck.role": "Claims supported or unsourced. Never invents.",
    "agent.factcheck.detail":
      "Splits sentences with numbers or strong claims and marks them as supported (cite a source), unverified (no source), or conflicted. Never invents a source that isn't in the text.",
    "agent.recommender.name": "Recommender",
    "agent.recommender.role": "Prioritized actions based on real metrics.",
    "agent.recommender.detail":
      "Reads the outputs from extractor, SEO, and fact-check —never computes its own numbers— and prioritizes up to 5 actionable items as high, medium, or low priority.",
    "agent.reviewer.name": "Cross Reviewer",
    "agent.reviewer.role": "One agent reviews another: approves, revises, or blocks.",
    "agent.reviewer.detail":
      "Runs twice: first over extractor, SEO, and fact-check; then over the recommender. Issues approve, revise, or block for each agent it evaluates (agent-reviewing-agent).",

    "agentsPage.kicker": "Catalog",
    "agentsPage.title": "System agents",
    "agentsPage.subtitle":
      "Six specialized agents, each with its own granular permissions. Turn them on, off, or adjust thresholds from the Permissions panel on the Dashboard.",
    "agentsPage.defaultPerms": "Default permissions",
    "agentsPage.noDefaultPerms": "No default permissions",

    "workflowsPage.kicker": "Pipeline definition",
    "workflowsPage.title": "Content Intelligence Pipeline",
    "workflowsPage.subtitle":
      "A single workflow, seven steps, with one parallel branch and a cross-review that runs twice. Permissions and thresholds (minimum confidence 0.70, HITL 0.85 by default) are configured on the Dashboard and directly affect which steps are skipped or blocked.",
    "workflowsPage.step1.title": "1. Classification",
    "workflowsPage.step1.detail":
      "The orchestrator decides whether the input is url, article, or copy (based on text length or whether a URL arrived) and orders the graph based on that type.",
    "workflowsPage.step1.meta": "Orchestrator",
    "workflowsPage.step2.title": "2. Extraction",
    "workflowsPage.step2.detail":
      "The extractor builds 5 fields (title, audience, keywords, tone, length), each with its own confidence score and a quote as evidence.",
    "workflowsPage.step2.meta": "Extractor",
    "workflowsPage.step3.title": "3. SEO and Fact-check in parallel",
    "workflowsPage.step3.detail":
      "SEO computes readability and keyword density; Fact-check splits claims into supported / unverified / conflicted. They run at the same time and each respects its own permissions.",
    "workflowsPage.step3.meta": "Quality / SEO · Fact-check",
    "workflowsPage.step4.title": "4. Cross review (pass 1)",
    "workflowsPage.step4.detail":
      "The reviewer evaluates extractor, SEO, and fact-check. It issues approve, revise, or block for each — agent-reviewing-agent.",
    "workflowsPage.step4.meta": "Cross Reviewer",
    "workflowsPage.step5.title": "5. Recommendations",
    "workflowsPage.step5.detail":
      "The recommender reads the previous outputs (never computes its own numbers) and prioritizes up to 5 actions as high / medium / low priority.",
    "workflowsPage.step5.meta": "Recommender",
    "workflowsPage.step6.title": "6. Cross review (pass 2)",
    "workflowsPage.step6.detail":
      "The reviewer runs again, this time over the recommender, and updates its decision summary.",
    "workflowsPage.step6.meta": "Cross Reviewer",
    "workflowsPage.step7.title": "7. Consolidation",
    "workflowsPage.step7.detail":
      "The orchestrator averages the confidence of the agents that finished, decides whether HITL is required (a field below threshold or low overall confidence), and narrates the result with Claude if an API key is configured.",
    "workflowsPage.step7.meta": "Orchestrator",
    "workflowsPage.inputKindsTitle": "Input types and how they change the flow",
    "workflowsPage.kind.url.label": "url",
    "workflowsPage.kind.url.detail":
      "A public URL arrives. The orchestrator fetches it (if it has the fetch_url permission) and converts the HTML to text before continuing.",
    "workflowsPage.kind.article.label": "article",
    "workflowsPage.kind.article.detail":
      "280+ character text with no URL. Full flow: SEO evaluates depth and implied H2/H3 structure.",
    "workflowsPage.kind.copy.label": "copy",
    "workflowsPage.kind.copy.detail":
      "Short text (<280 characters). Audience is inferred as 'landing page visitor' and recommendations prioritize the opening hook.",
    "workflowsPage.thresholdsTitle": "Thresholds that govern decisions",
    "workflowsPage.minConfTitle": "Minimum confidence — 0.70",
    "workflowsPage.minConfDetail":
      "If an agent finishes below this value, its decision becomes \"blocked\" in the results dashboard.",
    "workflowsPage.hitlTitle": "HITL threshold — 0.85",
    "workflowsPage.hitlDetail":
      "Below this value, a field is flagged needsHuman and the package requires human sign-off before publishing.",

    "logsPage.kicker": "Audit",
    "logsPage.title": "Persisted logs",
    "logsPage.subtitle":
      "Every run that passes through Supabase lands here, grouped by run_id, with timestamp, agent, field, confidence, and evidence — exactly what you see in the Dashboard's live console, but persisted.",
    "logsClient.loading": "Loading…",
    "logsClient.disabledTitle": "Persistence disabled",
    "logsClient.disabledDesc":
      "Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to save every run. In the meantime, the Dashboard's live console keeps working over SSE during an active run.",
    "logsClient.noRunsTitle": "No runs recorded",
    "logsClient.noRunsDesc":
      "Run the pipeline on the Dashboard; every log is automatically persisted here by run_id.",
    "logsClient.refresh": "Refresh",
  },
} as const;

export type TranslationKey = keyof typeof dictionaries.es;
