#!/usr/bin/env python3
import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageChops


def crop_content(image_path: Path, out_path: Path):
    img = Image.open(image_path).convert("RGB")
    gray = img.convert("L")
    bg = Image.new("L", gray.size, 255)
    diff = ImageChops.difference(gray, bg)
    bbox = diff.point(lambda p: 255 if p < 245 else 0).getbbox()
    if not bbox:
        crop = img
    else:
        left, top, right, bottom = bbox
        pad_x = max(24, int(img.width * 0.018))
        pad_y = max(24, int(img.height * 0.018))
        crop = img.crop((
            max(0, left - pad_x),
            max(0, top - pad_y),
            min(img.width, right + pad_x),
            min(img.height, bottom + pad_y),
        ))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path, optimize=True)


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: render_c_version_page_crops.py manifest.json")
    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    for item in manifest:
        pdf = Path(item["pdf"])
        page = str(item["page"])
        out = Path(item["out"])
        if out.exists():
            continue
        with tempfile.TemporaryDirectory() as td:
            prefix = Path(td) / "page"
            subprocess.run(
                ["pdftoppm", "-f", page, "-l", page, "-r", "170", "-png", str(pdf), str(prefix)],
                check=True,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            rendered = sorted(Path(td).glob("page-*.png"))
            if not rendered:
                raise RuntimeError(f"pdftoppm did not render {pdf} page {page}")
            crop_content(rendered[0], out)


if __name__ == "__main__":
    main()
