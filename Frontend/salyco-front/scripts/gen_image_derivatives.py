#!/usr/bin/env python3
"""Generate AVIF/WebP siblings for raster images. Originals are never modified.

For every `foo.png` found, this writes `foo.png.avif` and `foo.png.webp` next to
it. nginx serves whichever the browser accepts (see nginx.conf), falling back to
the untouched original when no derivative exists or the browser is old.

Why sibling files rather than a converted tree: the original stays byte-identical
and remains the fallback, so nothing can regress if a derivative is bad or a
codec is unsupported. Deleting the derivatives reverts the site to exactly its
previous behaviour.

Quality is ADAPTIVE, not fixed. Each image is encoded, measured against its
source with PSNR, and re-encoded at a higher quality until it clears the floor
(default 38 dB, "visually indistinguishable at normal viewing distance"). A flat
quality number cannot do this: on real Salyco assets, quality=50 gave 39.9 dB on
the hero photo but only 34.4 dB on the product placeholder -- visibly soft. The
ladder spends bytes only where the image needs them.

Images are NOT resized by default; full resolution is preserved and only the
codec changes. Pass --max-width to additionally cap dimensions.

Usage
-----
    python gen_image_derivatives.py dist                    # repo build output
    python gen_image_derivatives.py dist /app/media         # several roots
    python gen_image_derivatives.py dist --min-psnr 40      # stricter quality
    python gen_image_derivatives.py dist --max-width 2400   # also downscale
    python gen_image_derivatives.py dist --force            # ignore mtimes
    python gen_image_derivatives.py dist --dry-run          # report only

Idempotent: a derivative is rebuilt only when missing or older than its source,
so re-running after copying one new image in processes only that image.
"""

from __future__ import annotations

import argparse
import math
import os
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops, features
except ImportError:  # pragma: no cover
    sys.exit("Pillow is required:  pip install --upgrade Pillow")

Image.init()

SOURCE_SUFFIXES = {".png", ".jpg", ".jpeg"}

# Below this, a derivative costs more in overhead than it saves. Favicons and
# sprites also live down here and are better left exactly as authored.
MIN_BYTES = 8 * 1024

# PSNR floor. 38 dB is the practical threshold for "no visible difference" on
# photographic content; 34 and below shows as softness on flat colour and edges.
DEFAULT_MIN_PSNR = 38.0

# Quality ladders, ascending. Encoding stops at the first rung clearing the floor.
AVIF_LADDER = (50, 62, 72, 80, 88)
WEBP_LADDER = (78, 85, 90, 94)

AVIF_SPEED = 4      # 0 slowest/smallest .. 10 fastest/largest
WEBP_METHOD = 6     # 0 fastest .. 6 smallest

# A derivative must beat the original by at least this much to be worth keeping.
MIN_GAIN = 0.10


def human(n: float) -> str:
    if n < 1024:
        return f"{n:,.0f} B"
    for unit in ("KB", "MB", "GB"):
        n /= 1024
        if abs(n) < 1024 or unit == "GB":
            return f"{n:,.1f} {unit}"
    return f"{n:,.1f} GB"


def flatten(im: Image.Image) -> Image.Image:
    """Composite onto white so alpha is compared consistently.

    Without this, converting an RGBA source straight to RGB exposes whatever
    garbage sits under fully-transparent pixels and PSNR reads catastrophically
    low for images that are in fact fine.
    """
    im = im.convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    return Image.alpha_composite(bg, im).convert("RGB")


def psnr(a: Image.Image, b: Image.Image) -> float:
    a, b = flatten(a), flatten(b)
    if a.size != b.size:
        b = b.resize(a.size, Image.LANCZOS)
    hist = ImageChops.difference(a, b).histogram()
    sq = n = 0
    for ch in range(3):
        for value, count in enumerate(hist[ch * 256:(ch + 1) * 256]):
            sq += value * value * count
            n += count
    if not n:
        return 99.0
    mse = sq / n
    return 99.0 if mse == 0 else 10 * math.log10(255 ** 2 / mse)


def is_stale(src: Path, out: Path, force: bool) -> bool:
    if force or not out.exists():
        return True
    return out.stat().st_mtime < src.stat().st_mtime


def load_for_encode(src: Path, max_width: int | None) -> Image.Image:
    im = Image.open(src)
    im.load()

    has_alpha = im.mode in ("RGBA", "LA", "PA") or "transparency" in im.info
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if has_alpha else "RGB")

    if max_width and im.width > max_width:
        height = round(im.height * max_width / im.width)
        im = im.resize((max_width, height), Image.LANCZOS)

    return im


def save_at(im: Image.Image, path: Path, fmt: str, quality: int) -> None:
    if fmt == "AVIF":
        im.save(path, "AVIF", quality=quality, speed=AVIF_SPEED)
    else:
        im.save(path, "WEBP", quality=quality, method=WEBP_METHOD)


def encode_adaptive(im: Image.Image, out: Path, fmt: str,
                    src_bytes: int, min_psnr: float) -> tuple[int, float, int] | None:
    """Climb the quality ladder until PSNR clears the floor.

    Returns (bytes, psnr, quality), or None if no rung produced a derivative
    both good enough and meaningfully smaller than the source.
    """
    ladder = AVIF_LADDER if fmt == "AVIF" else WEBP_LADDER
    tmp = out.with_suffix(out.suffix + ".part")
    best: tuple[int, float, int] | None = None

    try:
        for quality in ladder:
            try:
                save_at(im, tmp, fmt, quality)
            except Exception:
                return None

            size = tmp.stat().st_size
            score = psnr(im, Image.open(tmp))

            # Stop climbing once the derivative stops being worth serving.
            if size >= src_bytes * (1 - MIN_GAIN):
                break

            best = (size, score, quality)
            if score >= min_psnr:
                os.replace(tmp, out)
                return best

        # Floor never reached, but the top rung may still be a large win.
        if best and best[1] >= min_psnr - 4.0:
            save_at(im, tmp, fmt, best[2])
            os.replace(tmp, out)
            return best

        return None
    finally:
        if tmp.exists():
            tmp.unlink(missing_ok=True)


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("roots", nargs="+", type=Path,
                    help="directories to walk (recursively)")
    ap.add_argument("--min-psnr", type=float, default=DEFAULT_MIN_PSNR,
                    help=f"quality floor in dB (default {DEFAULT_MIN_PSNR})")
    ap.add_argument("--max-width", type=int, default=None,
                    help="also downscale to this width (default: keep original size)")
    ap.add_argument("--min-bytes", type=int, default=MIN_BYTES,
                    help=f"skip sources smaller than this (default {MIN_BYTES})")
    ap.add_argument("--force", action="store_true",
                    help="rebuild derivatives even when up to date")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would happen, write nothing")
    args = ap.parse_args()

    formats = []
    if features.check("avif"):
        formats.append(("AVIF", ".avif"))
    else:
        print("note: Pillow lacks AVIF support -- generating WebP only",
              file=sys.stderr)
    if features.check("webp"):
        formats.append(("WEBP", ".webp"))
    if not formats:
        print("Pillow has neither AVIF nor WebP support; nothing to do.",
              file=sys.stderr)
        return 1

    src_total = served_total = 0
    made = skipped = dropped = failed = 0

    for root in args.roots:
        if not root.is_dir():
            print(f"skip (not a directory): {root}", file=sys.stderr)
            continue

        for src in sorted(root.rglob("*")):
            if not src.is_file() or src.suffix.lower() not in SOURCE_SUFFIXES:
                continue
            # Never treat a derivative as a source.
            if len(src.suffixes) > 1 and src.suffixes[-2].lower() in SOURCE_SUFFIXES:
                continue

            src_bytes = src.stat().st_size
            if src_bytes < args.min_bytes:
                continue

            targets = [(fmt, src.with_name(src.name + ext)) for fmt, ext in formats]
            todo = [(f, o) for f, o in targets if is_stale(src, o, args.force)]
            if not todo:
                skipped += 1
                continue

            if args.dry_run:
                print(f"would build {len(todo)}x  {src}  ({human(src_bytes)})")
                made += len(todo)
                continue

            try:
                im = load_for_encode(src, args.max_width)
            except Exception as exc:
                print(f"FAIL open {src}: {exc}", file=sys.stderr)
                failed += 1
                continue

            print(f"{src.relative_to(root)}  ({human(src_bytes)}, "
                  f"{im.width}x{im.height})")
            best_served = src_bytes

            for fmt, out in todo:
                result = encode_adaptive(im, out, fmt, src_bytes, args.min_psnr)
                if result is None:
                    out.unlink(missing_ok=True)
                    dropped += 1
                    print(f"   {fmt:4} dropped (no useful size/quality tradeoff)")
                    continue

                size, score, quality = result
                made += 1
                best_served = min(best_served, size)
                flag = "" if score >= args.min_psnr else "  [below floor]"
                print(f"   {fmt:4} {human(size):>10}  -{100 * (1 - size / src_bytes):4.1f}%"
                      f"  q={quality:<3} {score:4.1f} dB{flag}")

            src_total += src_bytes
            served_total += best_served

    print("\n" + "-" * 62)
    print(f"derivatives written : {made}")
    print(f"already up to date  : {skipped}")
    if dropped:
        print(f"dropped             : {dropped}")
    if failed:
        print(f"failed              : {failed}")
    if src_total:
        saved = src_total - served_total
        print(f"originals           : {human(src_total)}")
        print(f"best-case served    : {human(served_total)}")
        print(f"saving              : {human(saved)}  ({100 * saved / src_total:.1f}%)")
    print("originals were not modified.")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
