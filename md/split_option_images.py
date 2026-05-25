"""Split each furniture card image into per-option crops of just the sketch.

Each card image `NN_X.jpg` in `md/images/cards/furniture/` stacks two options
vertically (option 1 on top, option 2 on bottom). For each half we:

1. Trim the blue card frame
2. Detect the largest connected dark component (= the geometric grid sketch,
   ignoring the Chinese title + dashed arrow which are smaller components)
3. Crop tightly to that bbox with a small padding

Result files: `app/public/cards/options/NN_X_optK.jpg`
"""
from __future__ import annotations
from pathlib import Path
import numpy as np
from PIL import Image
from scipy.ndimage import label

SRC = Path(__file__).parent / 'images' / 'cards' / 'furniture'
OUT = Path(__file__).parent.parent / 'app' / 'public' / 'cards' / 'options'
ORIG_OUT = Path(__file__).parent.parent / 'app' / 'public' / 'cards' / 'original'
OUT.mkdir(parents=True, exist_ok=True)
ORIG_OUT.mkdir(parents=True, exist_ok=True)


def crop_to_sketch(half: Image.Image) -> Image.Image:
    """Crop to the largest connected neutral-dark component (the sketch grid).

    The blue card frame is filtered out by excluding high-saturation pixels.
    The title text and dashed arrow stay as separate (smaller) connected
    components, since their thin strokes don't bridge into the sketch in the
    raw mask. So the largest component is the sketch's grid + filled cells,
    and its bbox gives a tight crop.
    """
    arr = np.array(half.convert('RGB')).astype(int)
    H, W = arr.shape[:2]
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    max_ch = np.maximum(np.maximum(r, g), b)
    min_ch = np.minimum(np.minimum(r, g), b)
    saturation = max_ch - min_ch  # 0 = perfectly neutral gray
    mask = (max_ch < 175) & (saturation < 45)

    labeled, num = label(mask, structure=np.ones((3, 3), dtype=int))
    if num == 0:
        return half
    sizes = np.bincount(labeled.ravel())
    sizes[0] = 0  # background
    largest = int(sizes.argmax())
    ys, xs = np.where(labeled == largest)
    if len(ys) == 0:
        return half

    pad = max(4, min(W, H) // 80)
    y0 = max(0, int(ys.min()) - pad)
    y1 = min(H, int(ys.max()) + pad)
    x0 = max(0, int(xs.min()) - pad)
    x1 = min(W, int(xs.max()) + pad)
    return half.crop((x0, y0, x1, y1))


count = 0
for path in sorted(SRC.glob('*.jpg')):
    name = path.stem  # e.g. "01_A" or "01_back"
    if not name[0].isdigit() or '_' not in name:
        continue
    num, suffix = name.split('_', 1)
    if suffix not in ('A', 'B'):
        continue  # skip "_back" or other

    img = Image.open(path).convert('RGB')
    W, H = img.size
    # Also publish the original card image so the review UI can show it.
    # Use a slightly lossy save for size; the file is only used for visual
    # inspection so quality 80 is plenty.
    img.save(ORIG_OUT / f'{num}_{suffix}.jpg', quality=80)
    # Trim outer blue card frame (~6-8% on each side to clear frame + interior).
    pad_w = int(W * 0.08)
    pad_h = int(H * 0.06)
    body = img.crop((pad_w, pad_h, W - pad_w, H - pad_h))
    bw, bh = body.size
    mid = bh // 2
    # Pull each half away from the central divider line (thick black bar between
    # the two options) by ~4% of body height, so it doesn't dominate the
    # row-projection used to find the sketch.
    gap = max(10, bh // 25)

    top = body.crop((0, 0, bw, mid - gap))
    bot = body.crop((0, mid + gap, bw, bh))

    top_cropped = crop_to_sketch(top)
    bot_cropped = crop_to_sketch(bot)

    top_path = OUT / f'{num}_{suffix}_opt1.jpg'
    bot_path = OUT / f'{num}_{suffix}_opt2.jpg'
    top_cropped.save(top_path, quality=88)
    bot_cropped.save(bot_path, quality=88)
    count += 2

print(f'wrote {count} option images to {OUT}')
