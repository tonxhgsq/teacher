#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

OUT = Path("tmp/c版_ocr_probe/calc_c_p8_preview.json")

items = [
    {
        "content": "计算下面各题。（1）0.43̇ + 0.52̇ = （2）3.63̇ + 5.19̇ = （3）1.487̇ - 0.43̇ = （4）0.21̇ + 0.347̇ = （5）3.46̇ + 6.53̇ - 2 = （6）0.01̇ + 0.12̇ + 0.23̇ + 0.34̇ + 0.78̇ + 0.89̇ = （7）0.6̇ × 1.42̇ = （8）1.23̇ ÷ 0.037̇ =",
        "firstCategory": "计算",
        "secondCategory": "小数计算",
        "sourceImage": "tmp/c版_ocr_probe/crops/calc_c_p8_example1_block.png",
        "needsImage": True,
        "note": "OCR 能识别主体，但循环点会丢；按 PDF 补循环点，并保留题块截图。",
    },
    {
        "content": "计算下面各题。（9）(0.15̇ + 0.218̇) × 0.3̇ × 11/111 = （10）5/40 × 9 - 0.142857̇ × 0.125 - 0.857142̇ × 1/8 =",
        "firstCategory": "计算",
        "secondCategory": "小数计算",
        "sourceImage": "tmp/c版_ocr_probe/crops/calc_c_p8_example1_9_10.png",
        "needsImage": True,
        "note": "OCR 漏掉分数和循环点，必须保留局部截图。",
    },
    {
        "content": "计算下面各题。（1）1.33̇ + 0.52̇ = （2）2.46̇ + 5.17̇ = （3）2.35̇ - 0.3̇ = （4）0.1̇ + 0.01̇ + 0.001̇ = （5）0.26̇ + 7.53̇ - 2.14̇ = （6）0.12̇ + 1.23̇ + 2.34̇ + 3.45̇ + 4.56̇ + 5.67̇ + 6.78̇ + 7.89̇ + 8.90̇ + 9.01̇ = （7）1.24̇ × 0.3̇ = （8）0.391̇ ÷ 0.4̇ =",
        "firstCategory": "计算",
        "secondCategory": "小数计算",
        "sourceImage": "tmp/c版_ocr_probe/crops/calc_c_p8_practice_block.png",
        "needsImage": True,
        "note": "OCR 把 0.001 识别成 0.00i，需按 PDF 修正。",
    },
    {
        "content": "计算下面各题。（9）1.621̇ × 0.5 - (1/3 - 0.25̇) ÷ 3又1/2 + 0.189̇ = （10）5/8 × 0.571428̇ - 0.285714̇ × 0.25 + 0.714285̇ × 1/2 =",
        "firstCategory": "计算",
        "secondCategory": "小数计算",
        "sourceImage": "tmp/c版_ocr_probe/crops/calc_c_p8_practice_9_10.png",
        "needsImage": True,
        "note": "OCR 漏掉分数线和循环点，必须保留局部截图。",
    },
]

OUT.write_text(json.dumps({"page": 8, "items": items}, ensure_ascii=False, indent=2), encoding="utf-8")
print(OUT)
