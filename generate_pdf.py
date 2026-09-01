#!/usr/bin/env python3
"""Regenerate Portafolio-Proyectos-David-Herrera.pdf from portafolio.html."""

from pathlib import Path

from weasyprint import HTML

ROOT = Path(__file__).resolve().parent
src = ROOT / "portafolio.html"
out = ROOT / "Portafolio-Proyectos-David-Herrera.pdf"

HTML(filename=str(src)).write_pdf(str(out))
print(f"Wrote {out}")


if __name__ == "__main__":
    pass
