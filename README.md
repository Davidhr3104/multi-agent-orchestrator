# Helix monorepo

npm workspaces: Helix Orchestrator + Helix for Leads + Helix for Legal + `@helix/core`.

```bash
npm install
npm run dev:core    # http://127.0.0.1:43147
npm run dev:leads   # http://127.0.0.1:43148
npm run dev:legal   # http://127.0.0.1:43149
```

## Helix Orchestrator (proyecto #1)

Sistema multi-agente de análisis de contenido. Detalle: `multi-agent-orchestrator/README.md`.

## Helix for Legal

Template vertical: RFP extract + FACT + match score, HITL, mock corpus. Detalle: `apps/legal/README.md`.

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
