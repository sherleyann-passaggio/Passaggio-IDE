#!/usr/bin/env python3
"""
parse_snippets.py
Chat Snippet → Intelligence Ingest Parser
──────────────────────────────────────────
Reads raw chat/export markdown files from the snippets/ directory,
extracts insight blocks, and emits structured JSON for injection
into Phase 0/1 of the workflow pipeline.

Usage:
    python3 parse_snippets.py *.md > ../intelligence_ingest.json
    python3 parse_snippets.py --single insight.md --out ../intelligence_ingest.json
"""

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List


def _extract_insights(text: str) -> List[Dict[str, str]]:
    """Naïve but robust extractor for **Topic**, **Key quote**, **Impact** blocks."""
    insights = []
    # Find "## Insight" or "### Decision" headers and grab the bullet list below
    blocks = re.split(r"\n##\s+", text)
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        # Extract bold-labelled lines
        topic = _first_match(r"\*\*Topic\*\*[:\s]+(.+)", block)
        quote = _first_match(r"\*\*Key quote\*\*[:\s]+(.+)", block)
        impact = _first_match(r"\*\*Impact\*\*[:\s]+(.+)", block)
        if topic or quote or impact:
            insights.append({
                "topic": topic or "",
                "key_quote": quote or "",
                "impact": impact or "",
                "raw_fragment": block[:400],
            })
    return insights


def _first_match(pattern: str, text: str) -> str:
    m = re.search(pattern, text, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def parse_file(path: Path) -> Dict[str, any]:
    text = path.read_text(encoding="utf-8")
    return {
        "source": path.name,
        "insights": _extract_insights(text),
    }


def main():
    p = argparse.ArgumentParser(description="Parse chat snippets into JSON intelligence.")
    p.add_argument("files", nargs="*", help="Markdown snippet files to parse")
    p.add_argument("--single", type=Path, help="Single file mode")
    p.add_argument("--out", type=Path, help="Write JSON to file instead of stdout")
    args = p.parse_args()

    results = []
    targets = args.files
    if args.single:
        targets = [args.single]

    for f in targets:
        fp = Path(f)
        if fp.exists() and fp.suffix == ".md":
            results.append(parse_file(fp))
        else:
            print(f"⚠️  Skipping {f}: not found or not .md", file=sys.stderr)

    payload = {
        "ingest_type": "chat_snippets",
        "count": len(results),
        "sources": results,
    }

    blob = json.dumps(payload, indent=2, ensure_ascii=False)
    if args.out:
        args.out.write_text(blob, encoding="utf-8")
        print(f"✅ Ingest written to {args.out}")
    else:
        print(blob)


if __name__ == "__main__":
    main()
