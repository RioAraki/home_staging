#!/usr/bin/env python3
"""Convert furniture card crops into white-line, transparent-background PNGs
for the Cocos blueprint look (matching the web's CSS `filter: invert(1)`).

For each `cocos/.../resources/cards/options/*.jpg` we output a same-named
`.png` under `cocos/.../resources/cards/vector/` where:
  - RGB is forced to white
  - alpha = 255 * (1 - luminance)   # dark ink -> opaque white, white -> clear

So the dark sketch becomes a white line drawing on transparency, which reads
as white-on-navy once placed on the blueprint background.
"""
import os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(
    HERE, "..", "cocos", "home-staging-cocos", "assets", "resources", "cards", "options"))
DST = os.path.normpath(os.path.join(
    HERE, "..", "cocos", "home-staging-cocos", "assets", "resources", "cards", "vector"))


def convert(path: str, out_path: str) -> None:
    img = Image.open(path).convert("RGB")
    px = img.load()
    w, h = img.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0
            a = int(round(255 * (1.0 - lum)))
            op[x, y] = (255, 255, 255, a)
    out.save(out_path, "PNG")


def main() -> None:
    os.makedirs(DST, exist_ok=True)
    files = [f for f in os.listdir(SRC) if f.lower().endswith(".jpg")]
    files.sort()
    for i, f in enumerate(files, 1):
        stem = os.path.splitext(f)[0]
        convert(os.path.join(SRC, f), os.path.join(DST, stem + ".png"))
        if i % 40 == 0 or i == len(files):
            print(f"  {i}/{len(files)}")
    print(f"Done: {len(files)} PNGs -> {DST}")


if __name__ == "__main__":
    main()
