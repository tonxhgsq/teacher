#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

import pypdf

from titi_inventory import ROOT, classify_file, normalize_title

OUT = Path("tmp/titi_pdf_audit.json")


def pdf_text_stats(path: Path) -> dict:
    try:
        reader = pypdf.PdfReader(str(path))
        page_count = len(reader.pages)
        sample_pages = min(page_count, 3)
        text = "\n".join((reader.pages[i].extract_text() or "") for i in range(sample_pages))
        full_chars_est = 0
        for i in range(sample_pages):
            full_chars_est += len(reader.pages[i].extract_text() or "")
        avg = full_chars_est / max(1, sample_pages)
        return {
            "ok": True,
            "pages": page_count,
            "sampleChars": len(text.strip()),
            "estimatedChars": int(avg * page_count),
            "sample": text.strip()[:800],
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc), "pages": 0, "sampleChars": 0, "estimatedChars": 0, "sample": ""}


def main() -> None:
    rows = []
    for path in sorted(ROOT.rglob("*.pdf")):
        kind = classify_file(path)
        if kind != "question":
            continue
        stat = pdf_text_stats(path)
        rows.append({
            "path": str(path),
            "relative": str(path.relative_to(ROOT)),
            "title": normalize_title(path),
            **stat,
            "textLayer": stat.get("sampleChars", 0) >= 80,
        })
    summary = {
        "questionPdfCount": len(rows),
        "withTextLayer": sum(1 for r in rows if r["textLayer"]),
        "scannedOrLowText": sum(1 for r in rows if not r["textLayer"]),
        "totalPages": sum(r.get("pages", 0) for r in rows),
    }
    payload = {"summary": summary, "pdfs": rows}
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print("LOW_TEXT_EXAMPLES")
    for r in rows:
        if not r["textLayer"]:
            print(r["relative"], "pages", r["pages"], "chars", r["sampleChars"])


if __name__ == "__main__":
    main()
