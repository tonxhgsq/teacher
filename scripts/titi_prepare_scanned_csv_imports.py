#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

OUT = Path("tmp/titi_scanned_csv_imports.json")

SOURCES = [
    (
        "A3 2026小升初 广东重点名校入学分班真卷 数学.pdf",
        Path("/Users/tang/Desktop/titi/2026小升初真题试卷数学/A3 2026小升初 广东重点名校入学分班真卷 数学.csv"),
    ),
    ("模拟卷11.pdf", Path("/Users/tang/Desktop/titi/小二刷题班/第11讲/模拟卷11.csv")),
    ("模拟卷12.pdf", Path("/Users/tang/Desktop/titi/小二刷题班/第12讲/模拟卷12.csv")),
    ("模拟卷13.pdf", Path("/Users/tang/Desktop/titi/小二刷题班/第13讲/模拟卷13.csv")),
    (
        "2025年小升初密考沃伦制胜宝典第一册12讲.pdf",
        Path("/Users/tang/Desktop/titi/小升初密考沃伦/2025年小升初密考沃伦制胜宝典第一册12讲.csv"),
    ),
    (
        "2025年小升初密考沃伦制胜宝典第二册9讲.pdf",
        Path("/Users/tang/Desktop/titi/小升初密考沃伦/2025年小升初密考沃伦制胜宝典第二册9讲.csv"),
    ),
]


def normalize_content(value: str) -> str:
    text = str(value or "").strip().replace("\ufeff", "")
    text = re.sub(r"^\s*\d{1,3}\s*[、.．]\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def read_csv(file_name: str, path: Path) -> dict:
    with path.open(encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    questions = []
    for row in rows:
        content = normalize_content(row.get("题目", ""))
        if not content:
            continue
        module = str(row.get("模块", "") or "").strip()
        questions.append({
            "content": content,
            "answer": "",
            "type": "",
            "difficulty": "基础",
            "knowledgePoint": "",
            "module": module,
        })
    return {
        "file": file_name,
        "fileType": "pdf",
        "sourceCsv": str(path),
        "questionCount": len(questions),
        "questions": questions,
    }


def main() -> None:
    imports = [read_csv(file_name, path) for file_name, path in SOURCES]
    OUT.write_text(json.dumps({"imports": imports}, ensure_ascii=False, indent=2), encoding="utf-8")
    print("imports", len(imports), "questions", sum(item["questionCount"] for item in imports))
    for item in imports:
        first = item["questions"][0]["content"] if item["questions"] else "NO QUESTIONS"
        print(item["file"], item["questionCount"], first[:100])


if __name__ == "__main__":
    main()
