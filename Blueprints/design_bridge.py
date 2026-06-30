#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
design_bridge.py
Passaggio IDE — Autonomous Design System Bridge via designmd MCP
───────────────────────────────────────────────────────────────
1. Reads a lead payload from ~/.passaggio/leads/
2. Extracts brand / industry keywords.
3. Spawns 'npx designmd-mcp' and communicates via JSON-RPC / stdio.
4. Searches the DESIGNmd library for a matching kit.
5. Downloads the best match.
6. Parses the DESIGN.md into a tailwind.config.js ready for Remotion/app use.
"""
import argparse
import json
import logging
import os
import re
import subprocess
import sys
import textwrap
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

LOGGER = logging.getLogger("DesignBridge")

# ─────────────────────────────────────────────────────────────────
# Minimal MCP stdio client (JSON-RPC 2.0)
# ─────────────────────────────────────────────────────────────────


class MCPClient:
    def __init__(self, command: List[str], env: Optional[Dict[str, str]] = None):
        self._id = 0
        self._stderr_lines: List[str] = []
        self.proc = subprocess.Popen(
            command,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,
            env={**os.environ, **(env or {})},
        )

        # Drain stderr on a daemon thread so the MCP server never deadlocks
        def _drain_stderr() -> None:
            try:
                for line in self.proc.stderr:
                    self._stderr_lines.append(line)
                    LOGGER.debug("MCP server stderr: %s", line.strip())
            except Exception:
                pass

        threading.Thread(target=_drain_stderr, daemon=True).start()
        self._handshake()

    # ── internal helpers ─────────────────────────────────────────

    def _send(self, obj: dict) -> None:
        line = json.dumps(obj) + "\n"
        self.proc.stdin.write(line)
        self.proc.stdin.flush()

    def _recv(self, target_id: int, timeout: float = 120.0) -> dict:
        start = time.monotonic()
        while True:
            if time.monotonic() - start > timeout:
                raise TimeoutError(f"No JSON-RPC response for id {target_id}")
            line = self.proc.stdout.readline()
            if not line:
                raise RuntimeError("MCP server stdout closed unexpectedly")
            try:
                msg = json.loads(line)
            except json.JSONDecodeError:
                continue
            if msg.get("id") == target_id:
                if "error" in msg:
                    raise RuntimeError(f"MCP error: {msg['error']}")
                return msg
            # ignore notifications / unsolicited messages

    def _handshake(self) -> None:
        result = self.call(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "passaggio-design-bridge", "version": "0.1.0"},
            },
        )
        LOGGER.debug("MCP init result: %s", result)
        # required notification
        self._send(
            {
                "jsonrpc": "2.0",
                "method": "notifications/initialized",
                "params": {},
            }
        )

    # ── public API ───────────────────────────────────────────────

    def call(self, method: str, params: dict) -> Any:
        self._id += 1
        req_id = self._id
        self._send({"jsonrpc": "2.0", "id": req_id, "method": method, "params": params})
        resp = self._recv(req_id)
        return resp["result"]

    def tools_list(self) -> List[dict]:
        return self.call("tools/list", {}).get("tools", [])

    def tool_call(self, name: str, arguments: dict) -> dict:
        return self.call("tools/call", {"name": name, "arguments": arguments})

    def cleanup(self) -> None:
        try:
            self.proc.stdin.close()
            self.proc.terminate()
            self.proc.wait(timeout=5)
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────
# Lead → keywords
# ─────────────────────────────────────────────────────────────────


def extract_keywords(lead: dict) -> str:
    structured = lead.get("structuredData", {})
    industry = (
        structured.get("industry")
        or structured.get("business_type")
        or structured.get("type")
        or ""
    )
    summary = str(lead.get("summary", ""))
    url = (
        structured.get("website_url")
        or structured.get("url")
        or structured.get("company_website")
        or ""
    )
    if url:
        domain = re.sub(r"^https?://", "", url).split("/")[0].replace("www.", "")
        return f"{industry} {domain} {summary}".strip()
    return f"{industry} {summary}".strip()


def infer_tags(keywords: str) -> List[str]:
    tags = []
    kw_lower = keywords.lower()
    if any(w in kw_lower for w in ["saas", "software", "app", "platform", "tech"]):
        tags.append("saas")
    if any(w in kw_lower for w in ["dark", "night", "midnight", "black"]):
        tags.append("dark")
    if any(
        w in kw_lower
        for w in ["minimal", "clean", "simple", "modern", "flat"]
    ):
        tags.append("minimal")
    if any(w in kw_lower for w in ["gradient", "vibrant", "neon", "colorful"]):
        tags.append("gradient")
    return tags


# ─────────────────────────────────────────────────────────────────
# DESIGN.md → Tailwind inversion
# ─────────────────────────────────────────────────────────────────


def parse_design_md(design_md_path: str) -> str:
    text = Path(design_md_path).read_text(encoding="utf-8")

    # 1️⃣ Look for an explicit Tailwind config block inside markdown fences
    block_re = re.compile(
        r"```(?:js|javascript|ts|typescript)\n(.*?)```", re.DOTALL
    )
    blocks = block_re.findall(text)
    for block in blocks:
        lowered = block.lower()
        if any(k in lowered for k in ["tailwind", "module.exports", "theme"]):
            return block.strip()

    # 2️⃣ Fallback: extract hex colors and build a basic config
    colors = list(dict.fromkeys(re.findall(r"#[0-9A-Fa-f]{3,8}\b", text)))

    def _clean(c: str) -> str:
        c = c.lower()
        if len(c) == 4:  # short hex
            return "#" + "".join([ch * 2 for ch in c[1:]])
        return c

    primary = _clean(colors[0]) if colors else "#1e293b"
    secondary = _clean(colors[1]) if len(colors) > 1 else "#64748b"
    accent = _clean(colors[2]) if len(colors) > 2 else "#3b82f6"

    return textwrap.dedent(
        f'''
        /** Auto-generated Tailwind config from DESIGN.md for Passaggio */
        module.exports = {{
          content: ["./src/**/*.{ts,tsx}"],
          theme: {{
            extend: {{
              colors: {{
                brand: {{
                  primary: '{primary}',
                  secondary: '{secondary}',
                  accent: '{accent}',
                }},
              }},
            }},
          }},
          plugins: [],
        }};
        '''  # noqa: W291
    ).strip()


# ─────────────────────────────────────────────────────────────────
# Main pipeline
# ─────────────────────────────────────────────────────────────────


def run_design_pipeline(lead_id: str) -> dict:
    # ── 1. Load lead ───────────────────────────────────────────
    lead_dir = Path.home() / ".passaggio" / "leads"
    possible_files = [
        lead_dir / f"{lead_id}.json",
        lead_dir / "approved.json",
        lead_dir / "approved.ndjson",
    ]

    lead: Optional[dict] = None
    for f in possible_files:
        if not f.exists():
            continue
        if f.name.endswith(".ndjson"):
            for line in f.read_text(encoding="utf-8").strip().splitlines():
                candidate = json.loads(line)
                if candidate.get("id") == lead_id:
                    lead = candidate
                    break
        else:
            candidate = json.loads(f.read_text(encoding="utf-8"))
            if candidate.get("id") == lead_id:
                lead = candidate
                break

    if lead is None:
        raise FileNotFoundError(f"Lead {lead_id} not found in {lead_dir}")

    keywords = extract_keywords(lead)
    tags = infer_tags(keywords)
    LOGGER.info("Lead %s keywords=%r tags=%r", lead_id, keywords, tags)

    # ── 2. Spawn MCP client ────────────────────────────────────
    designmd_api_key = os.getenv("DESIGNMD_API_KEY", "")
    if not designmd_api_key:
        LOGGER.warning("DESIGNMD_API_KEY not set — download may fail.")

    client = MCPClient(
        ["npx", "-y", "designmd-mcp"],
        env={"DESIGNMD_API_KEY": designmd_api_key},
    )

    try:
        tool_map = {t["name"]: t for t in client.tools_list()}
        LOGGER.debug("Available tools: %s", list(tool_map.keys()))

        # ── 3. Search design kit ─────────────────────────────────
        search_name = None
        for candidate in [
            "cHI0Fj0mcp0search_design_kits",
            "search_design_kits",
        ]:
            if candidate in tool_map:
                search_name = candidate
                break
        if not search_name:
            # fuzzy fallback
            for name, t in tool_map.items():
                desc = t.get("description", "").lower()
                if "search" in desc and "design" in desc:
                    search_name = name
                    break
        if not search_name:
            raise RuntimeError("designmd search tool not found in MCP server.")

        search_res = client.tool_call(
            search_name, {"query": keywords, "limit": 10, "tags": tags}
        )
        content = search_res.get("content", [])
        text_item = next((c for c in content if c.get("type") == "text"), None)

        if not text_item:
            raise RuntimeError("Search returned no text content.")

        results_text = text_item["text"]
        LOGGER.info("Search returned:\n%s", results_text)

        # Extract the first identifier username/kit-slug
        match = re.search(r"([a-z0-9_-]+/[a-z0-9_-]+)", results_text)
        if not match:
            raise RuntimeError("Could not extract kit identifier from search results.")
        identifier = match.group(1)
        LOGGER.info("Selected design kit: %s", identifier)

        # ── 4. Download design kit ───────────────────────────────
        download_name = None
        for candidate in [
            "cHI0Fj0mcp0download_design_kit",
            "download_design_kit",
        ]:
            if candidate in tool_map:
                download_name = candidate
                break
        if not download_name:
            for name, t in tool_map.items():
                desc = t.get("description", "").lower()
                if "download" in desc and "design" in desc:
                    download_name = name
                    break
        if not download_name:
            raise RuntimeError("designmd download tool not found in MCP server.")

        output_dir = Path.home() / ".passaggio" / "designs" / lead_id
        output_dir.mkdir(parents=True, exist_ok=True)
        design_md_path = output_dir / "DESIGN.md"

        dl_res = client.tool_call(
            download_name,
            {"identifier": identifier, "path": str(design_md_path)},
        )
        LOGGER.info("Download result: %s", dl_res)

        # ── 5. Parse DESIGN.md → Tailwind config ─────────────────
        tailwind_config = parse_design_md(str(design_md_path))
        tailwind_path = output_dir / "tailwind.config.js"
        tailwind_path.write_text(tailwind_config, encoding="utf-8")

        # ── 6. Write manifest ────────────────────────────────────
        manifest = {
            "lead_id": lead_id,
            "keywords": keywords,
            "tags": tags,
            "design_kit": identifier,
            "design_md_path": str(design_md_path),
            "tailwind_config_path": str(tailwind_path),
        }
        manifest_path = output_dir / "manifest.json"
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        LOGGER.info("Manifest written to %s", manifest_path)

        return manifest

    finally:
        client.cleanup()


# ─────────────────────────────────────────────────────────────────
# CLI entrypoint
# ─────────────────────────────────────────────────────────────────


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description="Passaggio Design Bridge — autonomous design-spec generation via designmd MCP"
    )
    parser.add_argument("--lead-id", required=True, help="Lead UUID")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging")
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
        stream=sys.stderr,
    )

    try:
        manifest = run_design_pipeline(args.lead_id)
        print(json.dumps(manifest, indent=2))
        return 0
    except Exception as exc:
        LOGGER.exception("Design pipeline failed")
        print(json.dumps({"error": str(exc)}), indent=2)
        return 1


if __name__ == "__main__":
    sys.exit(main())