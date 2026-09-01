# Helix Orchestrator

Multi-Agent Orchestration System (proyecto #1 del portafolio). Análisis de contenido con agentes especializados, permisos granulares, revisión cruzada y logs auditables.

Reutiliza patrones ya construidos:

| Pieza existente | Cómo aparece aquí |
| --- | --- |
| Confidence-Scored Extraction Agent | Cada campo trae `confidence` + evidencia |
| Internal Knowledge Assistant (RAG) | Fact-check marca `unverified` en vez de inventar fuentes |
| Hermes Mini | Las métricas (conteo, keywords, scores) son determinísticas; el agente de recomendaciones narra sobre ellas |
| MCP-Connected Assistant | Cada decisión del orquestador se ve en el log |
| Sync & Drift Dashboard | Human-in-the-loop antes de tratar un paquete como listo |

## Agentes

1. **Extractor** — estructura título, audiencia, keywords, tono, extensión.
2. **Calidad / SEO** — legibilidad, meta, huecos (corre en paralelo).
3. **Verificación** — claims soportadas vs sin fuente (en paralelo con SEO).
4. **Recomendaciones** — acciones priorizadas.
5. **Revisor** — un agente revisa a los demás (`approve` / `revise` / `block`).
6. **Orquestador** — clasifica `url` | `article` | `copy`, arma el grafo y consolida.

## Correr en local

```bash
cd multi-agent-orchestrator
npm install
npm run dev
```

Abre [http://127.0.0.1:43147](http://127.0.0.1:43147).

Opcional (`.env.local`):

- `ANTHROPIC_API_KEY` — narración Claude al consolidar
- `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — persistir logs SSE (schema en `supabase/schema.sql`)

Sin keys el demo corre igual: logs en el stream, export JSON/PDF local.

## Demo

1. Deja el artículo de ejemplo y pulsa **Correr pipeline**.
2. Mira logs en vivo y el tablero de agentes.
3. Desactiva `Verificar hechos` o `Fetch de URL` en la matriz de permisos y vuelve a correr: el orquestador salta o bloquea al agente.
4. En **Resultado**, confirma los campos de baja confianza (checkpoint humano).
