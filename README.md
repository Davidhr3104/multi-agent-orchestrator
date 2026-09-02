# Helix monorepo

npm workspaces: Helix Orchestrator (content pipeline) + Helix for Lead Scoring + `@helix/core`.

```bash
npm install
npm run dev:core    # http://127.0.0.1:43147
npm run dev:leads   # http://127.0.0.1:43148
```

## Helix Orchestrator (proyecto #1)

Sistema multi-agente de análisis de contenido. Detalle: `multi-agent-orchestrator/README.md`.

## Helix for Lead Scoring

Template vertical: classify/score inbound leads, HITL review, mock CRM. Detalle: `apps/lead-scoring/README.md`.

## MCP PDF server

```bash
cd mcp-pdf-server
npm install
node index.js
```

## Documento interno

- [Portafolio-Proyectos-David-Herrera.pdf](./Portafolio-Proyectos-David-Herrera.pdf)
