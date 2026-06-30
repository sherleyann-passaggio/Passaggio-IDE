#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_runner.py
Sovereign Workstation — Isolated Test Runner
────────────────────────────────────────────
Executes local test suites inside safety-isolated subprocesses with
configurable timeouts and optional filesystem sandboxing.

Suited for:
  • pytest / unittest (Python)
  • npm test / jest / vitest (Node)
  • Custom shell commands

Emit structured JSON for consumption by extension.ts and orchestrator.py.
"""

import argparse
import json
import logging
import os
import platform
import shutil
import signal
import subprocess
import sys
import tempfile
import time
import traceback
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


LOGGER = logging.getLogger("SovereignTestRunner")

OSTYPE = platform.system().lower()
IS_POSIX = OSTYPE != "windows"
ENCODING = sys.getdefaultencoding() or "utf-8"
DEFAULT_TIMEOUT = 120.0


def _kill_proc_tree(pid: int, _timeout_secs: float = 5.0) -> bool:
  """
  Terminate a process and its descendants.

  Uses psutil if available; falls back to platform-specific process-group
  signalling (POSIX) or CTRL_BREAK_EVENT (Windows).
  """
  try:
      import psutil
      parent = psutil.Process(pid)
      children = parent.children(recursive=True)
      for child in children:
          try:
              child.terminate()
          except psutil.NoSuchProcess:
              pass
      gone, alive = psutil.wait_procs(children, timeout=_timeout_secs)
      for child in alive:
          try:
              child.kill()
          except psutil.NoSuchProcess:
              pass
      parent.terminate()
      try:
          parent.wait(timeout=_timeout_secs)
      except psutil.TimeoutExpired:
          parent.kill()
      return True
  except ImportError:
      pass

  if IS_POSIX:
      try:
          os.killpg(os.getpgid(pid), signal.SIGTERM)
      except (ProcessLookupError, OSError):
          pass
      return True
  else:
      try:
          os.kill(pid, signal.CTRL_BREAK_EVENT)
      except (ProcessLookupError, OSError, ValueError):
          pass
      return True


class IsolatedTestRunner:
  """
  Manages sandbox creation and subprocess execution with hard timeouts.
  """

  def __init__(
      self,
      sandbox_root: Optional[Path] = None,
      truncate_limit: int = 50_000,
  ):
      self.truncate_limit = truncate_limit
      self._tmpdirs: List[Path] = []
      self._worktrees: List[Path] = []
      self.sandbox_root = Path(
          sandbox_root
          or Path(__file__).resolve().parents[1] / "sandboxes"
      )
      self.sandbox_root.mkdir(parents=True, exist_ok=True)

  # ── Filesystem isolation ────────────────────────────────────────────
  def _prepare_copy(self, source: Path) -> Path:
      """Deep copy source into a disposable temp directory."""
      stamp = time.strftime("%Y%m%d_%H%M%S")
      rand = hex(int(time.time() * 1000) % 0xFFFF)[2:]
      dest = self.sandbox_root / f"sandbox_{stamp}_{rand}"
      dest.mkdir(parents=True, exist_ok=False)

      ignore = shutil.ignore_patterns(
          ".git", "__pycache__", "*.pyc", ".pytest_cache",
          "node_modules", ".venv", "venv", "env", ".env",
          ".mypy_cache", "build", "dist", "*.egg-info",
          ".idea", ".vscode",
      )
      shutil.copytree(source, dest / "workspace", ignore=ignore)
      self._tmpdirs.append(dest)
      LOGGER.info("Prepared copy sandbox: %s", dest)
      return dest / "workspace"

  def _prepare_worktree(self, source: Path) -> Path:
      """Lightweight git worktree isolation (requires source be inside a git repo)."""
      try:
          git_root = Path(
              subprocess.check_output(
                  ["git", "rev-parse", "--show-toplevel"],
                  cwd=source,
                  stderr=subprocess.DEVNULL,
                  text=True,
              ).strip()
          )
      except subprocess.CalledProcessError as exc:
          raise RuntimeError(
              "Source is not inside a git repository; cannot create worktree."
          ) from exc

      stamp = time.strftime("%Y%m%d_%H%M%S")
      rand = hex(int(time.time() * 1000) % 0xFFFF)[2:]
      dest = self.sandbox_root / f"worktree_{stamp}_{rand}"

      proc = subprocess.run(
          ["git", "worktree", "add", "-f", "--detach", str(dest)],
          cwd=git_root,
          capture_output=True,
          text=True,
      )
      if proc.returncode != 0:
          raise RuntimeError(f"git worktree add failed: {proc.stderr}")
      self._worktrees.append(dest)
      LOGGER.info("Prepared git worktree: %s", dest)
      return dest

  def prepare(
      self,
      source: Path,
      mode: str = "direct",
  ) -> Tuple[Path, Optional[Path]]:
      """
      Returns (cwd_for_subprocess, sandbox_path_or_None).
      In 'direct' mode, sandbox_path is None (runs in-place).
      """
      source = source.resolve()
      if mode == "direct":
          return source, None
      if mode == "copy":
          sandbox = self._prepare_copy(source)
          return sandbox, sandbox
      if mode == "worktree":
          sandbox = self._prepare_worktree(source)
          return sandbox, sandbox
      raise ValueError(f"Unknown isolation mode: {mode}")

  def cleanup(self) -> None:
      """Remove temporary directories and prune worktrees."""
      for d in self._tmpdirs:
          if d.exists():
              LOGGER.info("Removing temp sandbox: %s", d)
              shutil.rmtree(d, ignore_errors=True)
      for w in self._worktrees:
          subprocess.run(
              ["git", "worktree", "remove", "-f", str(w)],
              capture_output=True,
          )

  # ── Execution core ──────────────────────────────────────────────────
  def run(
      self,
      cmd: List[str],
      cwd: Path,
      env: Optional[Dict[str, str]] = None,
      timeout: float = DEFAULT_TIMEOUT,
      grace_period: float = 3.0,
  ) -> Dict[str, Any]:
      """
      Spawn isolated subprocess with hard timeout and process-tree cleanup.
      """
      merged_env = {**os.environ, **(env or {})}
      LOGGER.info("Running (timeout=%ss, cwd=%s): %s", timeout, cwd, cmd)

      start = time.monotonic()
      proc = None
      timed_out = False
      killed = False
      error: Optional[str] = None

      preexec = None
      creationflags = 0
      if IS_POSIX:
          preexec = os.setpgrp
      else:
          creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

      try:
          proc = subprocess.Popen(
              cmd,
              cwd=cwd,
              env=merged_env,
              stdout=subprocess.PIPE,
              stderr=subprocess.PIPE,
              preexec_fn=preexec,
              creationflags=creationflags,
          )

          try:
              stdout_b, stderr_b = proc.communicate(timeout=timeout)
              stdout = stdout_b.decode(ENCODING, errors="replace")
              stderr = stderr_b.decode(ENCODING, errors="replace")
              rc = proc.returncode
          except subprocess.TimeoutExpired:
              timed_out = True
              LOGGER.warning("Timeout exceeded after %ss — killing tree", timeout)
              if proc.pid:
                  killed = _kill_proc_tree(proc.pid, timeout_secs=grace_period)
              try:
                  stdout_b, stderr_b = proc.communicate(timeout=grace_period + 1.0)
                  stdout = stdout_b.decode(ENCODING, errors="replace")
                  stderr = stderr_b.decode(ENCODING, errors="replace")
              except Exception:
                  stdout = ""
                  stderr = f"Process killed after timeout ({timeout}s); output lost."
              rc = -9 if IS_POSIX else 1
          except Exception as exc:
              stdout = ""
              stderr = str(exc)
              rc = -3
              error = traceback.format_exc()

      except Exception as exc:
          stdout = ""
          stderr = str(exc)
          rc = -4
          error = traceback.format_exc()
          LOGGER.exception("Subprocess launch failed")
      finally:
          if proc is not None and proc.poll() is None:
              try:
                  proc.kill()
              except ProcessLookupError:
                  pass

      duration_ms = round((time.monotonic() - start) * 1000, 2)

      if len(stdout) > self.truncate_limit:
          stdout = stdout[:self.truncate_limit] + "\n...[truncated]..."
      if len(stderr) > self.truncate_limit:
          stderr = stderr[:self.truncate_limit] + "\n...[truncated]..."

      return {
          "success": rc == 0 and not timed_out,
          "returncode": rc,
          "timed_out": timed_out,
          "killed": killed,
          "duration_ms": duration_ms,
          "stdout": stdout,
          "stderr": stderr,
          "command": cmd,
          "cwd": str(cwd),
          "error": error,
      }


def main(argv: Optional[List[str]] = None) -> int:
  parser = argparse.ArgumentParser(
      description="Sovereign Isolated Test Runner",
      formatter_class=argparse.RawDescriptionHelpFormatter,
  )
  parser.add_argument(
      "command",
      nargs="+",
      help="Test command to execute, e.g.: pytest tests/ -xvs  OR  npm test",
  )
  parser.add_argument(
      "--cwd",
      type=Path,
      default=Path.cwd(),
      help="Working directory for the test invocation.",
  )
  parser.add_argument(
      "--timeout",
      type=float,
      default=DEFAULT_TIMEOUT,
      help="Per-test-suite wall-clock timeout in seconds.",
  )
  parser.add_argument(
      "--sandbox-mode",
      choices=["direct", "copy", "worktree"],
      default="direct",
      help=(
          "Filesystem isolation strategy:\n"
          "  direct   = run in-place (default)\n"
          "  copy     = deep-copy project to a temp sandbox\n"
          "  worktree = git worktree add (lightweight, git-only)"
      ),
  )
  parser.add_argument(
      "--sandbox-root",
      type=Path,
      default=None,
      help="Root directory for temporary sandboxes (default: workspace-ide/sandboxes).",
  )
  parser.add_argument(
      "--env",
      action="append",
      default=[],
      help="KEY=VALUE pair(s) injected into subprocess environment.",
  )
  parser.add_argument(
      "--output",
      type=Path,
      default=None,
      help="Write JSON result to this file instead of stdout.",
  )
  parser.add_argument(
      "--truncate-limit",
      type=int,
      default=50_000,
      help="Max chars per stdout/stderr stream in JSON payload.",
  )

  args = parser.parse_args(argv)

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s %(name)s %(levelname)s %(message)s",
      stream=sys.stderr,
  )

  runner = IsolatedTestRunner(
      sandbox_root=args.sandbox_root,
      truncate_limit=args.truncate_limit,
  )

  env_override: Dict[str, str] = {}
  for pair in args.env:
      if "=" not in pair:
          LOGGER.error("Invalid env pair (missing '='): %s", pair)
          sys.exit(2)
      k, v = pair.split("=", 1)
      env_override[k] = v

  try:
      _, sandbox = runner.prepare(args.cwd.resolve(), mode=args.sandbox_mode)
      result = runner.run(
          cmd=args.command,
          cwd=(sandbox if sandbox else args.cwd.resolve()),
          env=env_override,
          timeout=args.timeout,
      )
      result["sandbox_path"] = str(sandbox) if sandbox else None
  except Exception as exc:
      LOGGER.exception("Sandbox preparation or execution failed")
      result = {
          "success": False,
          "returncode": -5,
          "timed_out": False,
          "killed": False,
          "duration_ms": 0.0,
          "stdout": "",
          "stderr": str(exc),
          "command": args.command,
          "cwd": str(args.cwd.resolve()),
          "sandbox_path": None,
          "error": traceback.format_exc(),
      }
  finally:
      runner.cleanup()

  payload = json.dumps(result, indent=2, ensure_ascii=False)
  if args.output:
      args.output.write_text(payload, encoding="utf-8")
      print(args.output)
  else:
      print(payload)

  return 0 if result.get("success") else 1


if __name__ == "__main__":
  sys.exit(main())
