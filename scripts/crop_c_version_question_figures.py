#!/usr/bin/env python3
import json
import sys
from collections import deque
from pathlib import Path

from PIL import Image


def colored_components(img):
    rgb = img.convert("RGB")
    w, h = rgb.size
    pix = rgb.load()
    mask = set()
    for y in range(0, h):
        for x in range(0, w):
            r, g, b = pix[x, y]
            mx = max(r, g, b)
            mn = min(r, g, b)
            if mx - mn > 35 and mx > 120 and mn < 245:
                if 80 < x < w - 60 and 80 < y < h - 60:
                    mask.add((x, y))

    seen = set()
    comps = []
    for pt in list(mask):
        if pt in seen:
            continue
        stack = [pt]
        seen.add(pt)
        xs = []
        ys = []
        count = 0
        while stack:
            x, y = stack.pop()
            xs.append(x)
            ys.append(y)
            count += 1
            for nx in (x - 1, x, x + 1):
                for ny in (y - 1, y, y + 1):
                    np = (nx, ny)
                    if np in mask and np not in seen:
                        seen.add(np)
                        stack.append(np)
        if count > 20:
            comps.append((min(xs), min(ys), max(xs) + 1, max(ys) + 1, count))
    return comps


def overlaps(a, b, inflate=0):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    return not (
        ax2 + inflate < bx1
        or bx2 + inflate < ax1
        or ay2 + inflate < by1
        or by2 + inflate < ay1
    )


def union_box(boxes):
    return (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )


def find_label_anchors(comps, w, h):
    anchors = []
    for x1, y1, x2, y2, count in comps:
        bw = x2 - x1
        bh = y2 - y1
        if 45 <= bw <= 170 and 20 <= bh <= 75 and x1 < w * 0.25 and count > 300:
            if y1 > 120 and y2 < h - 80:
                anchors.append((y1 + y2) / 2)
    anchors = sorted(anchors)
    deduped = []
    for y in anchors:
        if not deduped or abs(y - deduped[-1]) > 50:
            deduped.append(y)
    return deduped


def diagram_clusters(comps, w, h):
    boxes = []
    for x1, y1, x2, y2, count in comps:
        bw = x2 - x1
        bh = y2 - y1
        if y1 < 170 or y2 > h - 65:
            continue
        if x1 < 260 and bw < 180:
            continue
        if bw > w * 0.72 and bh < 140:
            continue
        if bw > w * 0.78 or bh > h * 0.55:
            continue
        if count < 80 or bw < 12 or bh < 12:
            continue
        boxes.append((x1, y1, x2, y2))

    clusters = []
    for box in boxes:
        merged = False
        for cluster in clusters:
            if any(overlaps(box, other, inflate=55) for other in cluster):
                cluster.append(box)
                merged = True
                break
        if not merged:
            clusters.append([box])

    changed = True
    while changed:
        changed = False
        next_clusters = []
        while clusters:
            cluster = clusters.pop()
            box = union_box(cluster)
            merged = False
            for other in clusters:
                if overlaps(box, union_box(other), inflate=70):
                    other.extend(cluster)
                    changed = True
                    merged = True
                    break
            if not merged:
                next_clusters.append(cluster)
        clusters = next_clusters

    out = []
    for cluster in clusters:
        x1, y1, x2, y2 = union_box(cluster)
        bw = x2 - x1
        bh = y2 - y1
        if bw >= 45 and bh >= 35:
            out.append((x1, y1, x2, y2))
    return sorted(out, key=lambda b: ((b[1] + b[3]) / 2, b[0]))


def question_bands(anchor_count, anchors, h):
    if anchors:
        bands = []
        for i, y in enumerate(anchors):
            top = max(0, y - 25)
            bottom = h
            if i + 1 < len(anchors):
                bottom = (y + anchors[i + 1]) / 2
            bands.append((top, bottom))
        return bands

    step = h / max(1, anchor_count)
    return [(i * step, (i + 1) * step) for i in range(anchor_count)]


def save_crop(img, boxes, out_path):
    if not boxes:
        return False
    x1, y1, x2, y2 = union_box(boxes)
    w, h = img.size
    pad = 28
    crop = img.crop((
        max(0, int(x1 - pad)),
        max(0, int(y1 - pad)),
        min(w, int(x2 + pad)),
        min(h, int(y2 + pad)),
    ))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(out_path, optimize=True)
    return True


def process_page(page):
    img = Image.open(page["page_image"]).convert("RGB")
    w, h = img.size
    comps = colored_components(img)
    anchors = find_label_anchors(comps, w, h)
    clusters = diagram_clusters(comps, w, h)
    questions = page["questions"]

    relevant_anchors = anchors[: len(questions)]
    bands = question_bands(len(questions), relevant_anchors, h)
    written = []
    failures = []

    for idx, q in enumerate(questions):
        if q.get("box"):
            ok = save_crop(img, [tuple(q["box"])], Path(q["out"]))
            if ok:
                written.append(q["id"])
            else:
                failures.append(q["id"])
            continue
        top, bottom = bands[min(idx, len(bands) - 1)]
        candidates = [
            box
            for box in clusters
            if top <= (box[1] + box[3]) / 2 <= bottom
        ]
        if not candidates and idx < len(clusters):
            candidates = [clusters[idx]]
        ok = save_crop(img, candidates, Path(q["out"]))
        if ok:
            written.append(q["id"])
        else:
            failures.append(q["id"])
    return {"page": page["page"], "written": written, "failures": failures, "clusters": len(clusters), "anchors": len(anchors)}


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: crop_c_version_question_figures.py manifest.json")
    manifest = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    results = [process_page(page) for page in manifest]
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
