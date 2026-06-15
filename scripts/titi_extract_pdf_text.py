#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

import pypdf

OUT = Path("tmp/titi_pdf_text_questions.json")
AUDIT = Path("tmp/titi_pdf_audit.json")


SECTION_RE = re.compile(r"^(一|二|三|四|五|六|七|八|九|十)[、.．].{0,30}(题|选择|填空|解答|计算)")
Q_START_RE = re.compile(r"^\s*(\d{1,3})\s*(?:[．、]|[.](?!\d))\s*(.+)")
PAGE_RE = re.compile(r"第\s*\d+\s*页|共\s*\d+\s*页")
PRIVATE_USE_RE = re.compile(r"[\ue000-\uf8ff]")

PRIVATE_SYMBOLS = {
    "\uf02b": "+",
    "\uf02d": "-",
    "\uf03d": "=",
    "\uf03c": "<",
    "\uf03e": ">",
    "\uf0a3": "≤",
    "\uf0a5": "∞",
    "\uf0b0": "°",
    "\uf0b3": "≥",
    "\uf0b4": "×",
    "\uf0b8": "÷",
    "\uf0bc": "…",
    "\uf0d0": "∠",
    "\uf0d1": "∇",
    "\uf044": "△",
    "\uf056": "▽",
    "\uf070": "π",
    "\uf051": "Θ",
    "\uf057": "Ω",
    "\uf04c": "…",
    "\uf085": "≥",
    "\uf0ae": "→",
    "\uf02a": "∗",
    "\uf0a2": "′",
    "\uf06f": "°",
    "\uf028": "(",
    "\uf029": ")",
    "\uf067": "·",
    "\uf0b6": "弧",
}

RECURRING_DOT_MARKS = {"\uf026", "\uf0d7"}
DECORATIVE_SYMBOLS = {
    "\uf031", "\uf032", "\uf033", "\uf034",
    "\uf0e6", "\uf0e7", "\uf0e8", "\uf0e9", "\uf0ea", "\uf0eb", "\uf0ec", "\uf0ed", "\uf0ee", "\uf0ef",
    "\uf0f6", "\uf0f7", "\uf0f8", "\uf0f9", "\uf0fa", "\uf0fb",
    "\uf07b", "\uf0c4",
}


def extract_text(path: str) -> str:
    try:
        result = subprocess.run(
            ["pdftotext", "-raw", path, "-"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        if result.stdout.strip():
            return result.stdout
    except Exception:
        pass
    reader = pypdf.PdfReader(path)
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def clean_line(line: str) -> str:
    line = line.replace("\u00a0", " ")
    line = normalize_private_symbols(line)
    line = re.sub(r"\s+", " ", line).strip()
    return line


def normalize_private_symbols(text: str) -> str:
    out = []
    for ch in text:
        if ch in RECURRING_DOT_MARKS and out:
            out.append("\u0307")
            continue
        if ch in DECORATIVE_SYMBOLS:
            out.append(" ")
            continue
        out.append(PRIVATE_SYMBOLS.get(ch, ch))
    return "".join(out)


def is_noise(line: str) -> bool:
    if not line:
        return True
    if line in {"罗大帅主编", "内部资料，严禁外传"}:
        return True
    if PAGE_RE.search(line):
        return True
    if line.startswith("姓名") or "考试时间" in line and "分数" in line:
        return True
    if line.startswith("注意事项"):
        return True
    if line.startswith("请将答案") or line.startswith("答题前"):
        return True
    if "请将答案正确填写在答题卡上" in line:
        return True
    if SECTION_RE.match(line):
        return True
    # Handout title lines, not questions.
    if "王牌刷题" in line and len(line) < 40:
        return True
    return False


def split_questions(text: str) -> list[str]:
    lines = [clean_line(x) for x in text.splitlines()]
    questions: list[str] = []
    current: list[str] = []
    current_no: int | None = None
    for raw in lines:
        line = clean_line(raw)
        if is_noise(line):
            continue
        m = Q_START_RE.match(line)
        if m:
            n = int(m.group(1))
            # Most files are numbered sequentially. Accept restart only after current is empty.
            if current and (current_no is None or n > current_no or n == 1):
                questions.append("\n".join(current).strip())
                current = []
            current_no = n
            current.append(m.group(2).strip())
        elif current:
            current.append(line)
    if current:
        questions.append(" ".join(current).strip())

    cleaned = []
    for q in questions:
        q = re.sub(r"[ \t]{2,}", " ", q).strip()
        q = re.sub(r"\n{3,}", "\n\n", q)
        q = re.sub(r"^(例\s*\d+|练一练)\s*[:：、.．]?\s*", "", q)
        if len(q) >= 6 and not SECTION_RE.match(q):
            cleaned.append(q)
    return cleaned


def quality_flags(questions: list[str]) -> list[str]:
    joined = "\n".join(questions)
    flags = []
    if PRIVATE_USE_RE.search(joined):
        flags.append("公式符号疑似乱码")
    if "请将答案正确填写在答题卡上" in joined:
        flags.append("包含答题说明")
    if any(q.startswith(("答案", "解析", "详解")) for q in questions):
        flags.append("疑似答案解析混入")
    if questions and sum(1 for q in questions if len(q) < 10) >= max(3, len(questions) // 5):
        flags.append("短题干偏多")
    return flags


def main() -> None:
    audit = json.loads(AUDIT.read_text(encoding="utf-8"))
    imports = []
    for pdf in audit["pdfs"]:
        if not pdf.get("textLayer"):
            continue
        text = extract_text(pdf["path"])
        questions = split_questions(text)
        imports.append({
            "file": f"{pdf['title']}.pdf",
            "sourcePdf": pdf["path"],
            "relative": pdf["relative"],
            "fileType": "pdf",
            "questionCount": len(questions),
            "qualityFlags": quality_flags(questions),
            "questions": [
                {
                    "content": q,
                    "answer": "",
                    "type": "计算题",
                    "difficulty": "基础",
                    "knowledgePoint": "",
                }
                for q in questions
            ],
        })
    OUT.write_text(json.dumps({"imports": imports}, ensure_ascii=False, indent=2), encoding="utf-8")
    print("imports", len(imports), "questions", sum(x["questionCount"] for x in imports))
    for item in imports[:20]:
        print(item["file"], item["questionCount"], item["questions"][0]["content"][:80] if item["questions"] else "NO QUESTIONS")
    low = [x for x in imports if x["questionCount"] == 0]
    if low:
        print("ZERO", [x["relative"] for x in low])


if __name__ == "__main__":
    main()
