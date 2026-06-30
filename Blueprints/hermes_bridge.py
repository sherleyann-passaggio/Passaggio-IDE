#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
hermes_bridge.py
Sovereign Workstation — Hermes CLI Bridge
─────────────────────────────────────────
Execution wrappers bridging IDE instructions into Nous Research's Hermes
CLI daemon via ``hermes run --path <instruction_file>``.

Aligns with the local Modelfile contract (strict JSON mode) used by the
Sovereign Studio Engine and the Unified Gateway.

When the Hermes binary is absent, degrades gracefully to the Ollama HTTP
endpoint defined by LOCAL_LLM_BASE_URL / LOCAL_LLM_MODEL.
"""

import argparse
import json
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, HTTPServer
from socketserver import ThreadingMixIn
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

LOGGER = logging.getLogger("HermesBridge")

# ------------------------------------------------------------------
# Utilities
# ------------------------------------------------------------------


def _sanitize_for_shell(text: str) -> str:
  """Basic sanitization to avoid accidental injection in CLI metadata."""
  return text.replace("\x00", "")


def _extract_json_block(text: str) -> Tuple[Optional[Any], Optional[str]]:
  """Extract JSON object/array from raw text or markdown fences."""
  raw = text.strip()
  # Try raw parse first
  try:
      return json.loads(raw), None
  except json.JSONDecodeError:
      pass

  # Fenced code block
  fence = re.search(r"```(?:json)?\s*\n?(.*?)```", raw, re.DOTALL)
  if fence:
      inner = fence.group(1).strip()
      try:
          return json.loads(inner), None
      except json.JSONDecodeError:
          pass

  # Find outermost braces or brackets
  bracket_start = raw.find("[")
  brace_start = raw.find("{")
  if brace_start == -1 and bracket_start == -1:
      return None, "No JSON delimiters found in output."
  if brace_start == -1 or (bracket_start != -1 and bracket_start < brace_start):
      start, end = bracket_start, raw.rfind("]")
  else:
      start, end = brace_start, raw.rfind("}")
  if start == -1 or end == -1 or end <= start:
      return None, "Incomplete JSON delimiters in output."
  snippet = raw[start : end + 1]
  try:
      return json.loads(snippet), None
  except json.JSONDecodeError as exc:
      return None, f"JSONDecodeError: {exc}"


@dataclass
class HermesInstruction:
  """Payload schema written to the instruction file consumed by ``--path``."""
  prompt: str
  system: Optional[str] = None
  template: str = "chatml"
  options: Dict[str, Any] = field(default_factory=dict)


@dataclass
class HermesResult:
  success: bool
  raw: str = ""
  parsed: Optional[Any] = None
  command: Optional[list] = None
  error: Optional[str] = None
  duration_ms: float = 0.0
  fallback: bool = False


# ------------------------------------------------------------------
# Bridge
# ------------------------------------------------------------------


class HermesBridge:
  def __init__(
      self,
      binary: Optional[str] = None,
      modelfile: Optional[Path] = None,
      fallback_url: Optional[str] = None,
      model: Optional[str] = None,
      timeout: float = 120.0,
  ):
      """
      Parameters
      ----------
      binary
          Name or absolute path to the ``hermes`` executable.
          Defaults to ``$PATH/hermes``.
      modelfile
          Path to a Nous / Ollama Modelfile supplying system prompts.
      fallback_url
          Ollama-compatible HTTP endpoint (e.g. http://localhost:11434).
      model
          Model tag registered in the local daemon (default: hermes3).
      timeout
          Wall-clock seconds for a single ``run`` invocation.
      """
      resolved = shutil.which(binary or "hermes")
      self.binary_path: Optional[str] = resolved
      self.modelfile = Path(modelfile) if modelfile else None
      self.fallback_url = (
          fallback_url or os.getenv("LOCAL_LLM_BASE_URL", "http://localhost:11434")
      ).rstrip("/")
      self.model = model or os.getenv("LOCAL_LLM_MODEL", "hermes3")
      self.timeout = timeout

      if self.binary_path:
          LOGGER.info("Hermes binary located: %s", self.binary_path)
      else:
          LOGGER.warning(
              "Hermes binary not in $PATH — will fallback to HTTP on %s", self.fallback_url
          )

  # ------------------------------------------------------------------
  # Internal helpers
  # ------------------------------------------------------------------

  def _write_instruction_file(self, instruction: HermesInstruction) -> Path:
      """Serialize instruction to a temporary JSON file for ``--path``."""
      payload = {
          "prompt": instruction.prompt,
          "system": instruction.system or "",
          "template": instruction.template,
          "options": instruction.options,
      }
      if self.modelfile and self.modelfile.exists():
          payload["modelfile"] = str(self.modelfile.resolve())

      tmp = Path(tempfile.gettempdir()) / f"hermes_instr_{uuid.uuid4().hex}.json"
      tmp.write_text(json.dumps(payload, indent=2), encoding="utf-8")
      LOGGER.debug("Wrote instruction file: %s", tmp)
      return tmp

  def _run_cli(self, instruction_path: Path) -> Tuple[int, str, str, float]:
      """Spawn the Hermes CLI and block until completion or timeout."""
      cmd = [self.binary_path, "run", "--path", str(instruction_path)]
      LOGGER.info("Spawning Hermes CLI (%ss timeout): %s", self.timeout, " ".join(cmd))

      start = time.monotonic()
      try:
          proc = subprocess.Popen(
              cmd,
              stdout=subprocess.PIPE,
              stderr=subprocess.PIPE,
              text=True,
              encoding=sys.getdefaultencoding() or "utf-8",
          )
      except OSError as exc:
          LOGGER.exception("Failed to launch Hermes CLI")
          return -3, "", f"OSError launching hermes: {exc}", 0.0

      try:
          stdout, stderr = proc.communicate(timeout=self.timeout)
          rc = proc.returncode
      except subprocess.TimeoutExpired:
          LOGGER.warning("Hermes CLI timed out after %ss — terminating", self.timeout)
          proc.kill()
          stdout, stderr = proc.communicate()
          rc = -9
          stderr += f"\n[TIMEOUT: killed after {self.timeout}s]"

      duration = round((time.monotonic() - start) * 1000, 2)
      return rc, stdout, stderr, duration

  def _run_http_fallback(self, instruction: HermesInstruction) -> Tuple[int, str, str, float]:
      """Degrade to Ollama-style HTTP /api/generate when Hermes CLI is absent."""
      LOGGER.info("Falling back to HTTP %s /api/generate", self.fallback_url)

      try:
          import requests
      except ImportError:
          return -2, "", "requests library not installed; cannot HTTP fallback", 0.0

      url = f"{self.fallback_url}/api/generate"
      payload: Dict[str, Any] = {
          "model": self.model,
          "prompt": instruction.prompt,
          "stream": False,
          "options": instruction.options,
      }
      if instruction.system:
          payload["system"] = instruction.system

      start = time.monotonic()
      try:
          resp = requests.post(url, json=payload, timeout=self.timeout)
          resp.raise_for_status()
          data = resp.json()
          raw_text = data.get("response", "")
          duration = round((time.monotonic() - start) * 1000, 2)
          return 0, raw_text, "", duration
      except requests.exceptions.ConnectionError:
          duration = round((time.monotonic() - start) * 1000, 2)
          return -1, "", f"ConnectionError: cannot reach {url}", duration
      except Exception as exc:
          duration = round((time.monotonic() - start) * 1000, 2)
          return -1, "", f"HTTP fallback error: {exc}", duration

  # ------------------------------------------------------------------
  # Public API
  # ------------------------------------------------------------------

  def health_check(self) -> Dict[str, Any]:
      """Probe availability of CLI and fallback HTTP endpoint."""
      cli_ok = False
      if self.binary_path:
          try:
              proc = subprocess.run(
                  [self.binary_path, "--version"],
                  capture_output=True,
                  timeout=10,
              )
              cli_ok = proc.returncode == 0
          except Exception:
              pass

      http_ok = False
      http_detail = None
      try:
          import requests

          r = requests.get(f"{self.fallback_url}/api/tags", timeout=5)
          http_ok = r.status_code == 200
      except Exception as exc:
          http_detail = str(exc)

      return {
          "cli_available": cli_ok,
          "cli_path": self.binary_path,
          "http_available": http_ok,
          "http_detail": http_detail,
          "model": self.model,
      }

  def execute(
      self,
      prompt: str,
      system: Optional[str] = None,
      expect_json: bool = True,
      keep_instruction: bool = False,
      **options: Any,
  ) -> HermesResult:
      """
      Dispatch an instruction to Hermes and return structured output.

      Parameters
      ----------
      prompt
          The user instruction or code-generation prompt.
      system
          Optional system prompt overriding the Modelfile default.
      expect_json
          Whether to attempt strict JSON extraction from the response.
      keep_instruction
          If True, preserve the temporary instruction file on disk.
      **options
          Provider-specific generation options forwarded to the CLI/HTTP payload.

      Returns
      -------
      HermesResult
      """
      instruction = HermesInstruction(
          prompt=_sanitize_for_shell(prompt),
          system=system,
          options={
              "temperature": options.get("temperature", 0.2),
              "num_predict": options.get("max_tokens", 2048),
              **options,
          },
      )

      instruction_path: Optional[Path] = None
      stdout = ""
      stderr = ""
      rc = -1
      duration_ms = 0.0
      used_fallback = False

      try:
          if self.binary_path:
              instruction_path = self._write_instruction_file(instruction)
              rc, stdout, stderr, duration_ms = self._run_cli(instruction_path)
          else:
              used_fallback = True
              rc, stdout, stderr, duration_ms = self._run_http_fallback(instruction)

          if rc != 0:
              return HermesResult(
                  success=False,
                  raw=stdout,
                  parsed=None,
                  error=f"Non-zero exit code ({rc}). Stderr: {stderr}",
                  duration_ms=duration_ms,
                  fallback=used_fallback,
              )

          raw = stdout.strip()
          parsed: Optional[Any] = None
          error: Optional[str] = None

          if expect_json:
              parsed, error = _extract_json_block(raw)
              if error:
                  LOGGER.warning(
                      "JSON extraction failed — returning raw text. Detail: %s", error
                  )
          else:
              parsed = raw

          success = (not expect_json) or (parsed is not None)

          return HermesResult(
              success=success,
              raw=raw,
              parsed=parsed,
              error=None if success else error,
              duration_ms=duration_ms,
              fallback=used_fallback,
          )

      except Exception as exc:
          LOGGER.exception("Execute failed")
          return HermesResult(
              success=False,
              raw=stdout,
              parsed=None,
              error=f"{type(exc).__name__}: {exc}\n{traceback.format_exc()}",
              duration_ms=duration_ms,
              fallback=used_fallback,
          )
      finally:
          if instruction_path and not keep_instruction:
              try:
                  instruction_path.unlink(missing_ok=True)
              except Exception:
                  pass


class ThreadingHTTPServer(ThreadingMixIn, HTTPServer):
  """Handle requests in a separate thread."""


class VapiWebhookHandler(BaseHTTPRequestHandler):
  """
  A simple webhook handler that listens for POST requests from Vapi,
  parses the JSON payload, and logs it.
  """
  def _send_response(self, status_code, message):
    self.send_response(status_code)
    self.send_header("Content-type", "application/json")
    self.end_headers()
    self.wfile.write(json.dumps(message).encode("utf-8"))

  def do_POST(self):
    if self.path == '/vapi-webhook':
      try:
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)
        payload = json.loads(body)

        LOGGER.info("Received Vapi webhook payload: %s", json.dumps(payload, indent=2))

        # The vapi_prompt_guide.md specifies this structure
        message_data = payload.get('message', {})
        if message_data.get('role') == 'assistant' and message_data.get('type') == 'function-call':
            call_data = message_data.get('functionCall', {})
            if call_data.get('name') == 'send_lead_to_crm':
                lead_info = call_data.get('parameters', {})
                LOGGER.info("Extracted lead data: %s", json.dumps(lead_info, indent=2))
                # Here you would trigger the next step, e.g., calling the orchestrator
                # to create a project brief from this data.

        self._send_response(200, {"status": "success", "message": "Payload received"})
      except json.JSONDecodeError:
        LOGGER.error("Failed to decode JSON payload.")
        self._send_response(400, {"status": "error", "message": "Invalid JSON."})
      except Exception as e:
        LOGGER.error("An error occurred in webhook handler: %s", e)
        self._send_response(500, {"status": "error", "message": "Internal server error."})
    else:
      self._send_response(404, {"status": "error", "message": "Not Found"})

  def do_GET(self):
    if self.path == '/health':
        self._send_response(200, {"status": "ok"})
    else:
        self._send_response(404, {"status": "error", "message": "Not Found"})
# ------------------------------------------------------------------
# CLI entrypoint
# ------------------------------------------------------------------


def main(argv: Optional[list] = None) -> int:
  parser = argparse.ArgumentParser(
      description="Hermes Bridge — dispatch instructions to the local Hermes / Ollama stack.",
  )
  subparsers = parser.add_subparsers(dest="command")

  # 'run' command for original functionality
  run_parser = subparsers.add_parser('run', help='Run a prompt through the bridge.')
  run_parser.add_argument(
      "prompt",
      type=str,
      help="Inline prompt string or '@path' to read from file.",
  )
  run_parser.add_argument(
      "--system", "-s",
      default=None,
      help="System prompt override.",
  )
  parser.add_argument(
      "--binary",
      default="hermes",
      help="Hermes executable name or path.",
  )
  run_parser.add_argument(
      "--modelfile",
      type=Path,
      default=None,
      help="Path to local Modelfile.",
  )
  run_parser.add_argument(
      "--model",
      default=None,
      help="Ollama model tag (default hermes3).",
  )
  run_parser.add_argument(
      "--fallback-url",
      default=None,
      help="Ollama HTTP base URL.",
  )
  run_parser.add_argument(
      "--temperature",
      type=float,
      default=0.2,
  )
  run_parser.add_argument(
      "--max-tokens",
      type=int,
      default=2048,
  )
  run_parser.add_argument(
      "--expect-json",
      action="store_true",
      help="Force JSON extraction.",
  )
  run_parser.add_argument(
      "--keep-instruction",
      action="store_true",
      help="Preserve temp instruction file.",
  )
  run_parser.add_argument(
      "--output", "-o",
      type=Path,
      default=None,
      help="Write JSON result to file.",
  )

  # 'listen' command for the webhook server
  listen_parser = subparsers.add_parser('listen', help='Start the webhook listener server.')
  listen_parser.add_argument(
      '--port',
      type=int,
      default=8787,
      help='Port to listen on for incoming webhooks.'
  )
  listen_parser.add_argument(
      '--host',
      default='localhost',
      help='Host to bind the server to.'
  )

  # Default to 'listen' if no command is provided, for backward compatibility with start_webhook.sh
  if len(sys.argv) == 1:
      argv = ['listen'] + sys.argv[1:]

  args = parser.parse_args(argv)

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s %(name)s %(levelname)s %(message)s",
      stream=sys.stderr,
  )

  if args.command == 'run':
    prompt = args.prompt
    if prompt.startswith("@"):
        file_path = Path(prompt[1:])
        if not file_path.exists():
            LOGGER.error("Prompt file not found: %s", file_path)
            return 2
        prompt = file_path.read_text(encoding="utf-8")

    bridge = HermesBridge(
        binary=args.binary,
        modelfile=args.modelfile,
        fallback_url=args.fallback_url,
        model=args.model,
    )

    result = bridge.execute(
        prompt=prompt,
        system=args.system,
        expect_json=args.expect_json,
        keep_instruction=args.keep_instruction,
        temperature=args.temperature,
        max_tokens=args.max_tokens,
    )

    blob = json.dumps(asdict(result), indent=2, ensure_ascii=False)
    if args.output:
        args.output.write_text(blob, encoding="utf-8")
        print(args.output)
    else:
        print(blob)

    return 0 if result.success else 1

  elif args.command == 'listen':
    server_address = (args.host, args.port)
    httpd = ThreadingHTTPServer(server_address, VapiWebhookHandler)
    LOGGER.info("Starting webhook listener on http://%s:%s...", args.host, args.port)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    httpd.server_close()
    LOGGER.info("Webhook listener stopped.")
    return 0


if __name__ == "__main__":
  sys.exit(main())
