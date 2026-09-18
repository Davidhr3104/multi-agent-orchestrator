# Helix monorepo

npm workspaces: Helix Orchestrator + Helix for Leads + Helix for Legal + Helix for Inbox + Helix for Commerce + `@helix/core`.

```bash
npm install
npm run dev:core      # http://127.0.0.1:43147
npm run dev:leads     # http://127.0.0.1:43148
npm run dev:legal     # http://127.0.0.1:43149
npm run dev:commerce  # http://127.0.0.1:43150
npm run dev:inbox     # http://127.0.0.1:43151
```

## Live demos (Vercel)

- Helix Orchestrator: https://multi-agent-orchestrator-mu.vercel.app
- Helix for Leads: https://helix-for-leads.vercel.app
- Helix for Legal: https://helix-for-legal.vercel.app
- Helix for Commerce: https://helix-for-commerce.vercel.app
- Helix for Inbox: https://helix-for-inbox.vercel.app

Do not treat `lead-scoring-demo.vercel.app` as a Helix product.

The family PDF (`Helix_Catalogo_Familia.pdf`, if present) still needs a human pass to list these five live URLs.

## Helix Orchestrator (proyecto #1)

Sistema multi-agente de análisis de contenido. Detalle: `multi-agent-orchestrator/README.md`.

## Helix for Legal

Template vertical: RFP extract + FACT + match score, HITL, mock corpus. Detalle: `apps/legal/README.md`.

## Helix for Leads

Template vertical: classify/score inbound leads, HITL review, mock CRM. Detalle: `apps/lead-scoring/README.md`.

## Helix for Inbox

Template vertical: email triage, drafts, and HITL routing. Local `:43151`.

## Helix for Commerce

Template vertical: fraud scoring, inventory restock, HITL fulfill. Local `:43150`.

## MCP PDF server

```bash
cd mcp-pdf-server
npm install
node index.js
```

## Documento interno

- [Portafolio-Proyectos-David-Herrera.pdf](./Portafolio-Proyectos-David-Herrera.pdf)
