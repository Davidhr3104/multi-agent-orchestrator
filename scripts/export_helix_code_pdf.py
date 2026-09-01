#!/usr/bin/env python3
"""Export Helix's new design + Workflows/Agents/Logs source code to a PDF."""

import html
from pathlib import Path

from weasyprint import HTML

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "multi-agent-orchestrator"
OUT = ROOT / "Helix-Design-Workflows-Agents-Logs-Code.pdf"

SECTIONS = [
    ("Layout & estilos globales", [
        "src/app/layout.tsx",
        "src/app/globals.css",
        "src/app/page.tsx",
    ]),
    ("Sistema de idiomas (ES/EN)", [
        "src/lib/i18n/dictionaries.ts",
        "src/lib/i18n/language-provider.tsx",
        "src/components/language-toggle.tsx",
    ]),
    ("Nav, footer e íconos compartidos", [
        "src/components/top-nav.tsx",
        "src/components/page-footer.tsx",
        "src/components/icon.tsx",
    ]),
    ("Dashboard rediseñado", [
        "src/components/orchestrator-app.tsx",
        "src/components/agent-board.tsx",
        "src/components/control-panel.tsx",
        "src/components/log-stream.tsx",
        "src/components/result-dashboard.tsx",
        "src/components/result-panel.tsx",
    ]),
    ("Datos y permisos", [
        "src/lib/permissions.ts",
        "src/lib/config.ts",
        "src/lib/types.ts",
    ]),
    ("Página Workflows", [
        "src/app/workflows/page.tsx",
    ]),
    ("Página Agents", [
        "src/app/agents/page.tsx",
    ]),
    ("Página Logs", [
        "src/app/logs/page.tsx",
        "src/components/logs-client.tsx",
        "src/app/api/logs/route.ts",
    ]),
]


def read(path: str) -> str:
    full = APP / path
    if not full.exists():
        return f"// (archivo no encontrado: {path})"
    return full.read_text(encoding="utf-8")


def build_html() -> str:
    parts = [
        """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<title>Helix Orchestrator — Código: Diseño + Workflows + Agents + Logs</title>
<style>
  @page {
    size: Letter;
    margin: 0.65in 0.6in 0.8in 0.6in;
    @bottom-right { content: "Pág. " counter(page); font-size: 8.5pt; color: #64748b; }
  }
  @page :first { margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", Helvetica, Arial, sans-serif;
    color: #0f172a;
    font-size: 9.5pt;
    line-height: 1.4;
    margin: 0;
  }
  .cover {
    min-height: 11in;
    background: linear-gradient(165deg, #0a1424 0%, #10192c 55%, #0e3a44 100%);
    color: #e7f6fb;
    padding: 1.3in 0.9in;
  }
  .cover-kicker {
    letter-spacing: 0.2em;
    text-transform: uppercase;
    font-size: 9pt;
    color: #4cd7f6;
    margin-bottom: 16px;
  }
  .cover h1 { font-size: 30pt; line-height: 1.2; margin: 0 0 14px; }
  .cover p { font-size: 11pt; color: #b9c6d6; max-width: 6in; }
  .cover-list { margin-top: 30px; }
  .cover-list li { color: #cbd5e1; font-size: 10.5pt; margin-bottom: 6px; }
  h2.section {
    font-size: 15pt;
    color: #0f172a;
    border-bottom: 2.5px solid #06b6d4;
    padding-bottom: 5px;
    margin: 26px 0 4px;
    page-break-after: avoid;
  }
  h3.file {
    font-size: 10pt;
    font-family: "Consolas", "JetBrains Mono", monospace;
    color: #0e3a44;
    background: #e6fbff;
    border-left: 4px solid #06b6d4;
    padding: 5px 8px;
    margin: 14px 0 4px;
    page-break-after: avoid;
    word-break: break-all;
  }
  pre {
    background: #0e1320;
    color: #d7e3f5;
    padding: 10px 12px;
    border-radius: 4px;
    font-family: "Consolas", "JetBrains Mono", monospace;
    font-size: 7.6pt;
    line-height: 1.45;
    white-space: pre-wrap;
    word-wrap: break-word;
    page-break-inside: auto;
    margin: 0 0 10px;
  }
</style>
</head>
<body>
<section class="cover">
  <div class="cover-kicker">Helix Orchestrator · Código fuente</div>
  <h1>Diseño Material 3 + Workflows,<br/>Agents &amp; Logs</h1>
  <p>Exportación completa del rediseño de Helix Orchestrator: sistema de
  idiomas ES/EN, navegación compartida, dashboard rediseñado, y las tres
  páginas nuevas (Workflows, Agents, Logs) con sus componentes y rutas.</p>
  <ul class="cover-list">
"""
    ]
    for title, _ in SECTIONS:
        parts.append(f"    <li>{html.escape(title)}</li>\n")
    parts.append("""  </ul>
</section>
""")

    for title, files in SECTIONS:
        parts.append(f'<h2 class="section">{html.escape(title)}</h2>\n')
        for f in files:
            content = read(f)
            parts.append(f'<h3 class="file">{html.escape(f)}</h3>\n')
            parts.append(f"<pre>{html.escape(content)}</pre>\n")

    parts.append("</body></html>")
    return "".join(parts)


def main() -> None:
    doc = build_html()
    HTML(string=doc, base_url=str(APP)).write_pdf(str(OUT))
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
