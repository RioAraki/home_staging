"""Extract every BLOCK in a DXF file as a standalone SVG module.

CAD furniture libraries are usually organised as `BLOCKS` — each block is
one reusable symbol (a chair, a sofa, etc.). This script walks every
non-anonymous block, normalises its drawing extents into a 100×100
viewBox, converts its entities (LINE / CIRCLE / ARC / LWPOLYLINE /
POLYLINE / SPLINE / ELLIPSE) into SVG primitives, and writes one SVG
file per block.

Usage:
    python md/dxf_to_modules.py <input.dxf> [--out-dir DIR] [--limit N]

DWG input? Convert first with the free Autodesk ODA File Converter
(https://www.opendesign.com/guestfiles/oda_file_converter):
    ODAFileConverter "src_dwg_dir" "out_dxf_dir" "ACAD2018" "DXF" "0" "1"
"""

from __future__ import annotations

import argparse
import math
import re
import sys
from pathlib import Path

import ezdxf
from ezdxf import bbox as ezbbox

VIEW = 100.0                # output viewBox side (units per block)
STROKE = "rgba(255,255,255,0.92)"
STROKE_W = 1.0
FILL = "none"

# Block names AutoCAD assigns to anonymous / dynamic / paper-space
# helpers — skip these. Real user-named blocks are usually descriptive
# Chinese / English strings (e.g. "水龙头（大理石）-HS-01-31号").
ANON_RE = re.compile(
    r"^("
    r"\*[A-Z]\d+"                # *A1, *U2, etc.
    r"|[Aa]\$[A-Za-z]C?[0-9A-Fa-f]+"  # A$C1234ABCD — dynamic block anon
    r"|\*MODEL_SPACE|\*PAPER_SPACE"
    r"|\*Model_Space|\*Paper_Space"
    r"|_Model_Space|_Paper_Space"
    r")$",
)


def safe_filename(name: str) -> str:
    """Keep Chinese / Unicode names verbatim — Vite serves them fine —
    but replace path-hostile characters (slash, backslash, quotes, …)."""
    name = name.strip()
    # \w in Python's re is Unicode-aware by default and keeps Chinese.
    name = re.sub(r'[\\/<>:"|?*\s]+', "_", name)
    return name[:80] or "block"


def line_seg(pa, pb) -> str:
    return f"M {pa[0]:.2f} {pa[1]:.2f} L {pb[0]:.2f} {pb[1]:.2f}"


def arc_path(cx, cy, r, start_deg, end_deg) -> str:
    """SVG arc path for an open ARC (no fill)."""
    a0 = math.radians(start_deg)
    a1 = math.radians(end_deg)
    x0 = cx + r * math.cos(a0)
    y0 = cy + r * math.sin(a0)
    x1 = cx + r * math.cos(a1)
    y1 = cy + r * math.sin(a1)
    sweep = (end_deg - start_deg) % 360
    large = 1 if sweep > 180 else 0
    return f"M {x0:.2f} {y0:.2f} A {r:.2f} {r:.2f} 0 {large} 1 {x1:.2f} {y1:.2f}"


def polyline_path(pts, closed: bool) -> str:
    if not pts:
        return ""
    parts = [f"M {pts[0][0]:.2f} {pts[0][1]:.2f}"]
    for p in pts[1:]:
        parts.append(f"L {p[0]:.2f} {p[1]:.2f}")
    if closed:
        parts.append("Z")
    return " ".join(parts)


def entity_to_svg(e, transform):
    """Return list of SVG element strings for one DXF entity."""
    out: list[str] = []
    t = e.dxftype()
    try:
        if t == "LINE":
            a = transform((e.dxf.start.x, e.dxf.start.y))
            b = transform((e.dxf.end.x, e.dxf.end.y))
            out.append(
                f'<path d="{line_seg(a, b)}" stroke="{STROKE}" '
                f'stroke-width="{STROKE_W}" fill="{FILL}"/>',
            )
        elif t == "CIRCLE":
            c = transform((e.dxf.center.x, e.dxf.center.y))
            r = e.dxf.radius * transform.scale
            out.append(
                f'<circle cx="{c[0]:.2f}" cy="{c[1]:.2f}" r="{r:.2f}" '
                f'stroke="{STROKE}" stroke-width="{STROKE_W}" fill="{FILL}"/>',
            )
        elif t == "ARC":
            cx, cy = transform((e.dxf.center.x, e.dxf.center.y))
            r = e.dxf.radius * transform.scale
            d = arc_path(cx, cy, r, e.dxf.start_angle, e.dxf.end_angle)
            out.append(
                f'<path d="{d}" stroke="{STROKE}" stroke-width="{STROKE_W}" fill="none"/>',
            )
        elif t == "ELLIPSE":
            # Approximate as a quarter / full ellipse via sampled points
            # (good enough for furniture detail).
            cx, cy = transform((e.dxf.center.x, e.dxf.center.y))
            major = (e.dxf.major_axis.x, e.dxf.major_axis.y)
            ratio = e.dxf.ratio
            a = math.hypot(*major) * transform.scale
            b = a * ratio
            angle = math.degrees(math.atan2(major[1], major[0]))
            sa = math.degrees(e.dxf.start_param)
            ea = math.degrees(e.dxf.end_param)
            # Build coarse polyline by sampling.
            pts = []
            steps = 48
            for i in range(steps + 1):
                p = sa + (ea - sa) * i / steps
                rad = math.radians(p)
                lx = a * math.cos(rad)
                ly = b * math.sin(rad)
                ang = math.radians(angle)
                rx = lx * math.cos(ang) - ly * math.sin(ang)
                ry = lx * math.sin(ang) + ly * math.cos(ang)
                pts.append((cx + rx, cy + ry))
            out.append(
                f'<path d="{polyline_path(pts, False)}" stroke="{STROKE}" '
                f'stroke-width="{STROKE_W}" fill="none"/>',
            )
        elif t in {"LWPOLYLINE", "POLYLINE"}:
            pts = []
            if t == "LWPOLYLINE":
                for x, y, *_rest in e.get_points("xy"):
                    pts.append(transform((x, y)))
            else:
                for v in e.vertices:
                    pts.append(transform((v.dxf.location.x, v.dxf.location.y)))
            closed = bool(e.is_closed) if hasattr(e, "is_closed") else False
            if pts:
                out.append(
                    f'<path d="{polyline_path(pts, closed)}" stroke="{STROKE}" '
                    f'stroke-width="{STROKE_W}" fill="none"/>',
                )
        elif t == "SPLINE":
            pts = [transform((p.x, p.y)) for p in e.control_points]
            if len(pts) >= 2:
                out.append(
                    f'<path d="{polyline_path(pts, False)}" stroke="{STROKE}" '
                    f'stroke-width="{STROKE_W}" fill="none"/>',
                )
        # Everything else (HATCH, MTEXT, TEXT, DIMENSION, INSERT-of-INSERT…)
        # is skipped to keep modules clean. Nested INSERTs we could flatten
        # later if needed.
    except Exception as exc:
        print(f"  skip entity {t}: {exc}", file=sys.stderr)
    return out


class Transform:
    """Maps a block's drawing bbox to the 0..VIEW SVG space, keeping
    aspect ratio (longer side spans VIEW, other side centred)."""

    def __init__(self, bb):
        if bb is None or bb.has_data is False:
            self.scale = 1.0
            self.dx = 0.0
            self.dy = 0.0
            return
        ext_w = bb.size.x or 1.0
        ext_h = bb.size.y or 1.0
        s = VIEW / max(ext_w, ext_h)
        self.scale = s
        # SVG y axis flips relative to CAD.
        self.dx = -bb.extmin.x * s + (VIEW - ext_w * s) / 2
        self.dy = bb.extmax.y * s + (VIEW - ext_h * s) / 2

    def __call__(self, p):
        return (p[0] * self.scale + self.dx, -p[1] * self.scale + self.dy)


def flatten_block(block):
    """Yield every leaf-level (non-INSERT) entity reachable from `block`,
    with INSERT transforms applied via ezdxf's virtual_entities()."""
    for e in block:
        t = e.dxftype()
        if t == "INSERT":
            try:
                # virtual_entities() yields entities of the referenced
                # block already transformed into the host's coordinate
                # system. Nested INSERTs are expanded the same way by
                # ezdxf transparently.
                yield from e.virtual_entities()
            except Exception as exc:
                print(f"  skip INSERT {e.dxf.name}: {exc}", file=sys.stderr)
        else:
            yield e


def block_to_svg(block) -> tuple[str | None, int]:
    """Return (svg_string, entity_count). svg_string is None if the block
    has no renderable entities."""
    leaf_entities = list(flatten_block(block))
    if not leaf_entities:
        return None, 0
    bb = ezbbox.extents(leaf_entities, fast=True)
    transform = Transform(bb)
    elements: list[str] = []
    for e in leaf_entities:
        svgs = entity_to_svg(e, transform)
        elements.extend(svgs)
    if not elements:
        return None, 0
    body = "\n  ".join(elements)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {VIEW:.0f} {VIEW:.0f}" '
        f'width="{VIEW:.0f}" height="{VIEW:.0f}">\n'
        f'  {body}\n'
        f'</svg>\n'
    )
    return svg, len(elements)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dxf", type=Path, help="input DXF file")
    ap.add_argument("--out-dir", type=Path, default=Path("app/public/cards/modules"))
    ap.add_argument("--limit", type=int, default=0, help="only export N blocks (0 = all)")
    args = ap.parse_args()

    if not args.dxf.exists():
        print(f"file not found: {args.dxf}", file=sys.stderr)
        return 1

    print(f"reading {args.dxf} …")
    doc = ezdxf.readfile(str(args.dxf))
    blocks = [b for b in doc.blocks if not ANON_RE.match(b.name)]
    # Skip the model / paper space "blocks" — those are the drawing
    # canvases, not symbols.
    blocks = [
        b for b in blocks
        if b.name not in {"$MODEL_SPACE", "$PAPER_SPACE", "*MODEL_SPACE", "*PAPER_SPACE", "*Model_Space", "*Paper_Space"}
        and not b.name.startswith("*")
    ]
    print(f"found {len(blocks)} user-named blocks")

    args.out_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    for i, b in enumerate(blocks):
        if args.limit and written >= args.limit:
            break
        name = safe_filename(b.name)
        svg, n = block_to_svg(b)
        if svg is None:
            continue
        out = args.out_dir / f"{name}.svg"
        out.write_text(svg, encoding="utf-8")
        written += 1
        if written <= 30 or written % 100 == 0:
            print(f"  [{written}] {b.name!r:60s} → {name}.svg ({n} entities)")
    print(f"done. {written} svg modules written → {args.out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
