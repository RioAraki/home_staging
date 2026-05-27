"""Render each DXF's modelspace into a single big preview SVG.

Lets the user eyeball what's actually inside a CAD library file — the
modelspace usually shows a catalogue layout with every block placed
side by side. ezdxf's drawing addon does the heavy lifting (full
support for HATCH / MTEXT / INSERT / line types / colours).

Usage:
    python md/dxf_to_preview.py                  # process every DXF in D:\\DXF_IN
    python md/dxf_to_preview.py path/to/one.dxf  # just that one
"""

from __future__ import annotations

import sys
from pathlib import Path
import re

import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend, layout
from ezdxf.addons.drawing.svg import SVGBackend

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_IN = Path(r"D:\DXF_IN")
OUT_DIR = ROOT / "app" / "public" / "cards" / "dxf_previews"

# Output style — fits the blueprint backdrop.
BACKGROUND_HEX = "#102a47"


def render_file(dxf_path: Path, out_dir: Path) -> Path | None:
    try:
        doc = ezdxf.readfile(str(dxf_path))
    except Exception as exc:
        print(f"  skip {dxf_path.name}: {exc}", file=sys.stderr)
        return None
    ctx = RenderContext(doc)
    backend = SVGBackend()
    fe = Frontend(ctx, backend)
    fe.draw_layout(doc.modelspace())
    # Page(0, 0) = auto-fit to content bounds.
    page = layout.Page(0, 0)
    svg = backend.get_string(page)
    safe_stem = re.sub(r"[\\/<>:\"|?*\s]+", "_", dxf_path.stem)
    out = out_dir / f"{safe_stem}.svg"
    out.write_text(svg, encoding="utf-8")
    return out


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if len(sys.argv) > 1:
        files = [Path(sys.argv[1])]
    else:
        files = sorted(DEFAULT_IN.glob("*.dxf"))
    if not files:
        print(f"no DXF files at {DEFAULT_IN}", file=sys.stderr)
        return 1
    print(f"rendering {len(files)} DXF file(s) → {OUT_DIR}")
    for f in files:
        print(f"  {f.name} …", flush=True)
        out = render_file(f, OUT_DIR)
        if out:
            kb = out.stat().st_size // 1024
            print(f"    → {out.name} ({kb} KB)")
    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
