#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
orchestrator.py
Sovereign Workstation — Unified Multi-Provider Gateway & Self-Healing Runner
─────────────────────────────────────────────────────────────────────────────
Multi-turn orchestrator integrating:
• UnifiedModelGateway  (Vertex AI, Cohere, AI Studio, Local Hermes/Ollama)
• AST Parser           (structural dependency & contract extraction)
• Subprocess runners   (pytest, jest, remotion CLI, ffmpeg)

Intended to be spawned by workspace-ide/extension.ts; emits JSON state to stdout
and granular logs to stderr so the IDE UI can render progress and outcomes.
"""

import argparse
import json
import logging
import os
import re
import shlex
import shutil
import signal
import subprocess
import sys
import traceback
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional


# ── Ensure sibling scripts (gateway.py, ast_parser.py) are importable ──
_SCRIPT_DIR = Path(__file__).resolve().parent
if str(_SCRIPT_DIR) not in sys.path:
  sys.path.insert(0, str(_SCRIPT_DIR))

try:
  from dotenv import load_dotenv
except ImportError:  # pragma: no cover
  load_dotenv = None  # type: ignore

try:
  from gateway import UnifiedModelGateway, GatewayConfig
except ImportError as _exc:  # noqa: F841
  UnifiedModelGateway = None  # type: ignore
  GatewayConfig = None  # type: ignore

try:
  from ast_parser import index_directory, parse_file, DEFAULT_EXCLUDES
except ImportError as _exc:  # noqa: F841
  index_directory = None  # type: ignore
  parse_file = None  # type: ignore
  DEFAULT_EXCLUDES = set()

ENV_PATH = _SCRIPT_DIR / ".env"


def _load_env() -> None:
    """Load Blueprints/.env if python-dotenv is available."""
    if load_dotenv is not None and ENV_PATH.exists():
        load_dotenv(ENV_PATH, override=False)
        LOGGER.info("Loaded environment from %s", ENV_PATH)

# ── Tunables ───────────────────────────────────────────────────────────
MAX_HEALING_TURNS = 5
TEST_TIMEOUT_SEC = 120
LOGGER = logging.getLogger("SovereignOrchestrator")


# ── Data shapes ────────────────────────────────────────────────────────
@dataclass
class TurnState:
  """A single generate/test/heal attempt."""
  turn: int
  action: str = ""                     # generate | heal | verify
  files_written: List[str] = field(default_factory=list)
  test_returncode: int = -1
  test_stdout: str = ""
  test_stderr: str = ""
  llm_prompt_chars: int = 0
  llm_response: str = ""
  ast_snapshot: Optional[Dict[str, Any]] = None


@dataclass
class OrchestratorResult:
  """Top-level payload consumed by extension.ts."""
  success: bool
  command: str
  target: str
  turns: List[Dict[str, Any]]
  summary: str
  error: Optional[str] = None


# ── Core engine ────────────────────────────────────────────────────────
class SovereignOrchestrator:
  """
  Autonomous workspace execution engine.
  Maintains multi-turn conversational state with the LLM via UnifiedModelGateway.
  """

  def __init__(
      self,
      config: Optional[Any] = None,
      provider: Optional[str] = None,
  ):
      _load_env()
      self.gateway: Optional[Any] = None
      if UnifiedModelGateway is not None:
          self.gateway = UnifiedModelGateway(config)
      else:
          LOGGER.warning("gateway.py unavailable — running in degraded dry-run mode.")

      self.provider = provider or os.getenv("ACTIVE_LLM_PROVIDER", "local")
      self.history: List[TurnState] = []
      self._interrupted = False

      signal.signal(signal.SIGINT, self._on_signal)
      signal.signal(signal.SIGTERM, self._on_signal)

  # ── Internals ──────────────────────────────────────────────────────
  def _on_signal(self, signum, _frame):
      LOGGER.warning("Caught signal %d — will drain after current turn", signum)
      self._interrupted = True

  def _llm(self, prompt: str, system: Optional[str] = None) -> str:
      """Complete via UnifiedModelGateway."""
      if self.gateway is None:
          raise RuntimeError("LLM gateway not available (missing SDK?).")
      if self._interrupted:
          raise InterruptedError("Orchestrator interrupted by OS signal.")

      # Hard ceiling to avoid bloating context windows
      if len(prompt) > 120_000:
          tail = prompt[-100_000:]
          prompt = f"...[truncated {len(prompt) - len(tail)} chars]...\n{tail}"

      return self.gateway.complete(
          prompt,
          provider=self.provider,
          system=system,
          temperature=0.2,
          max_tokens=4096,
      )

  @staticmethod
  def _spawn(
      cmd: List[str],
      cwd: Optional[Path] = None,
      env: Optional[Dict[str, str]] = None,
      timeout: int = 60,
      shell: bool = False,
  ) -> tuple[int, str, str]:
      """
      Spawn a subprocess with timeout and unified error capture.
      Returns (returncode, stdout, stderr).
      """
      LOGGER.info("Spawning (%ss timeout, shell=%s): %s", timeout, shell, cmd)
      merged_env = {**os.environ, **(env or {})}
      try:
          proc = subprocess.run(
              cmd if not shell else " ".join(shlex.quote(c) for c in cmd),
              cwd=cwd,
              env=merged_env,
              capture_output=True,
              text=True,
              timeout=timeout,
              shell=shell,
          )
          return proc.returncode, proc.stdout, proc.stderr
      except subprocess.TimeoutExpired as exc:
          return -2, exc.stdout or "", exc.stderr or f"TIMEOUT after {timeout}s"
      except Exception as exc:
          return -3, "", str(exc)

  @staticmethod
  def _extract_code(raw: str) -> str:
      """Extract the first fenced code block; fall back to raw text."""
      fence = re.compile(
          r"```(?:python|py|typescript|ts|javascript|js)?\n(.*?)```", re.DOTALL
      )
      hits = fence.findall(raw)
      if hits:
          return hits[0].strip()
      return raw.strip()

  def _ast_ctx(self, target: Path, root: Path) -> Optional[Dict[str, Any]]:
      """Fetch structural context from the AST parser."""
      if target.is_file() and parse_file is not None:
          return parse_file(target, root, strip_boilerplate=True)
      if target.is_dir() and index_directory is not None:
          mods = index_directory(target, root, strip_boilerplate=True, excludes=DEFAULT_EXCLUDES)
          return {"modules": mods[:20], "truncated": len(mods) > 20}
      return None

  def _build_prompt(
      self,
      targets: List[Path],
      test_cmd: List[str],
      ast_ctx: Optional[Dict],
      prev: Optional[TurnState],
  ) -> str:
      """
      Assemble a structured prompt for the LLM.
      Includes AST contracts, previous failure traces, and current source files.
      """
      lines: List[str] = [
          "You are the Sovereign Self-Healing Agent.",
          "Fix the codebase so the test suite passes.",
          "Return ONLY the corrected file(s) inside markdown fenced code blocks.",
          "",
          "RULES:",
          "1. Do NOT delete healthy existing logic.",
          "2. Preserve import structures unless the bug demands a new dependency.",
          "3. Ensure the code is syntactically valid.",
          "",
          f"Test command: {' '.join(test_cmd)}",
          "",
      ]

      if ast_ctx:
          ctx_json = json.dumps(ast_ctx, indent=2)
          if len(ctx_json) > 4000:
              ctx_json = ctx_json[:4000] + "\n...[truncated]..."
          lines.append(f"AST Context (dependencies / signatures):\n{ctx_json}\n")

      if prev:
          lines.append(f"PREVIOUS ATTEMPT #{prev.turn} FAILED (returncode={prev.test_returncode}):")
          out = prev.test_stdout[:3000] if prev.test_stdout else ""
          err = prev.test_stderr[:3000] if prev.test_stderr else ""
          lines.append(f"STDOUT:\n{out}\nSTDERR:\n{err}\n")

      lines.append("Current source files:")
      for t in targets:
          if t.is_file():
              text = t.read_text(encoding="utf-8")
              lines.append(f"\n--- {t.name} ---\n{text[:8000]}\n--- end {t.name} ---")

      lines.append("\nProvide corrected code now.")
      return "\n".join(lines)

  # ── Public workflows ───────────────────────────────────────────────
  def run_self_healing(
      self,
      target: Path,
      test_cmd: List[str],
      project_root: Path,
      max_turns: int = MAX_HEALING_TURNS,
      system_prompt: Optional[str] = None,
      use_shell: bool = False,
  ) -> OrchestratorResult:
      """
      Multi-turn loop:
        AST snapshot → Prompt LLM → Write file(s) → Run tests → (fail → heal)
      """
      target = target.resolve()
      project_root = project_root.resolve()

      # Resolve which file(s) we will mutate
      mutate_targets: List[Path] = [target] if target.is_file() else []
      if not mutate_targets and target.is_dir():
          # Heuristic: mutate the most recently touched .py file
          py_files = sorted(target.rglob("*.py"), key=lambda p: p.stat().st_mtime, reverse=True)
          mutate_targets = py_files[:1]

      if not mutate_targets:
          return OrchestratorResult(
              success=False,
              command=" ".join(test_cmd),
              target=str(target),
              turns=[],
              summary="No mutable source files discovered.",
              error="Empty target or directory contains no .py files.",
          )

      turns_data: List[Dict[str, Any]] = []

      for turn in range(1, max_turns + 1):
          LOGGER.info("▶ Turn %d / %d", turn, max_turns)
          state = TurnState(turn=turn)

          if self._interrupted:
              state.test_stderr = "Interrupted by OS signal during turn startup."
              turns_data.append(asdict(state))
              break

          try:
              # 1. Structural awareness
              ast_ctx = self._ast_ctx(
                  mutate_targets[0].parent if len(mutate_targets) == 1 else target,
                  project_root,
              )
              state.ast_snapshot = ast_ctx

              # 2. Prompt composition
              prompt = self._build_prompt(
                  mutate_targets, test_cmd, ast_ctx,
                  prev=self.history[-1] if self.history else None,
              )
              state.llm_prompt_chars = len(prompt)

              # 3. LLM generation
              state.action = "generate" if turn == 1 else "heal"
              LOGGER.info("Querying provider=%s (%s)", self.provider, state.action)
              raw_resp = self._llm(prompt, system=system_prompt)
              state.llm_response = raw_resp[:500] + "..." if len(raw_resp) > 500 else raw_resp

              # 4. Extract code & write back
              new_code = self._extract_code(raw_resp)
              if not new_code:
                  raise ValueError("LLM emitted an empty code block.")

              for mt in mutate_targets:
                  mt.write_text(new_code, encoding="utf-8")
                  LOGGER.info("Wrote %s (%d chars)", mt, len(new_code))
              state.files_written = [str(p) for p in mutate_targets]

              # 5. Test invocation
              rc, out, err = self._spawn(
                  test_cmd, cwd=project_root, timeout=TEST_TIMEOUT_SEC, shell=use_shell
              )
              state.test_returncode = rc
              state.test_stdout = out
              state.test_stderr = err
              turns_data.append(asdict(state))
              self.history.append(state)

              if rc == 0:
                  LOGGER.info("✔ Tests passed on turn %d", turn)
                  return OrchestratorResult(
                      success=True,
                      command=" ".join(test_cmd),
                      target=str(target),
                      turns=turns_data,
                      summary=f"Healing succeeded after {turn} turn(s).",
                  )

              LOGGER.warning("✘ Tests failed (rc=%d) — healing...", rc)

              if turn == max_turns:
                  return OrchestratorResult(
                      success=False,
                      command=" ".join(test_cmd),
                      target=str(target),
                      turns=turns_data,
                      summary=f"Exhausted {max_turns} attempts; tests still failing.",
                      error=err[:4000],
                  )

          except Exception as exc:
              LOGGER.error("Crash on turn %d: %s", turn, exc)
              state.test_stderr = traceback.format_exc()
              turns_data.append(asdict(state))
              self.history.append(state)
              return OrchestratorResult(
                  success=False,
                  command=" ".join(test_cmd),
                  target=str(target),
                  turns=turns_data,
                  summary=f"Orchestrator crashed on turn {turn}.",
                  error=str(exc),
              )

      # Exhausted loop without resolution
      return OrchestratorResult(
          success=False,
          command=" ".join(test_cmd),
          target=str(target),
          turns=turns_data,
          summary="Unknown termination state.",
          error="Loop exited without pass/fail determination.",
      )

  def run_ast_index(
      self,
      target: Path,
      output: Optional[Path] = None,
  ) -> None:
      """Standalone AST indexer invoked by the IDE context-tree refresh command."""
      root = target.parent if target.is_file() else target
      if index_directory is None:
          LOGGER.error("ast_parser.py unavailable.")
          sys.exit(1)

      modules = index_directory(target, root, strip_boilerplate=True)
      payload = {"modules": modules}
      blob = json.dumps(payload, indent=2, ensure_ascii=False)

      if output:
          output.write_text(blob, encoding="utf-8")
          LOGGER.info("AST index written to %s", output)
          print(output)
      else:
          print(blob)

  def run_generate_audio(
       self,
       script_text: str,
       out_path: Path,
       tone: str = "casual",
       provider: str = "f5_tts_mlx"
   ) -> Dict[str, Any]:
       """
       Generates audio from text using F5-TTS-MLX (local Apple Silicon voice cloning).
       Reads tone-specific samples from voice_manifest.json.
       Auto-generates timestamps via local Whisper for Remotion captions.
       Falls back to a text stub if the engine is not installed.
       """
       LOGGER.info("Generating audio for script to %s using %s (tone=%s)", out_path, provider, tone)

       # ── Load voice manifest to resolve tone → sample + transcript ──
       voice_changer_dir = Path(
           "/Users/sherleybelleus/Library/Mobile Documents/com~apple~CloudDocs"
           "/The Passaggio Tech Stack/voice-changer"
       ).resolve()
       manifest_path = voice_changer_dir / "voice_manifest.json"

       if not manifest_path.exists():
           LOGGER.warning("Voice manifest not found at %s — falling back to stub.", manifest_path)
           return self._audio_fallback(script_text, out_path)

       with open(manifest_path, "r", encoding="utf-8") as f:
           manifest = json.load(f)

       tone_cfg = manifest.get("tones", {}).get(tone) or manifest.get("tones", {}).get(manifest.get("default_tone", "casual"))
       if not tone_cfg:
           LOGGER.warning("Tone '%s' not found in manifest — falling back to stub.", tone)
           return self._audio_fallback(script_text, out_path)

       ref_audio = Path(tone_cfg["source_sample"]).resolve()
       ref_text_path = Path(tone_cfg["source_transcript"]).resolve()

       if not ref_audio.exists() or not ref_text_path.exists():
           LOGGER.warning("Missing source sample or transcript for tone '%s' — falling back to stub.", tone)
           return self._audio_fallback(script_text, out_path)

       ref_text = ref_text_path.read_text(encoding="utf-8").strip()
       out_path.parent.mkdir(parents=True, exist_ok=True)
       temp_wav = out_path.with_suffix(".temp.wav")

       if provider == "f5_tts_mlx":
           try:
               import mlx.core as mx
               import f5_tts_mlx
               LOGGER.info("f5-tts-mlx detected. Running synthesis...")
           except ImportError:
               LOGGER.warning("f5-tts-mlx not installed — falling back to stub.")
               return self._audio_fallback(script_text, out_path)

           cmd = [
               sys.executable, "-m", "f5_tts_mlx.generate",
               "--text", script_text,
               "--ref-audio", str(ref_audio),
               "--ref-text", ref_text,
               "--output", str(temp_wav),
           ]

           try:
               rc, out, err = self._spawn(cmd, timeout=300)
               if rc != 0 or not temp_wav.exists():
                   LOGGER.warning("F5-TTS synthesis failed (rc=%d): %s", rc, err)
                   return self._audio_fallback(script_text, out_path)

               ffmpeg = shutil.which("ffmpeg")
               if ffmpeg:
                   mp3_cmd = [
                       ffmpeg, "-y", "-i", str(temp_wav),
                       "-codec:a", "libmp3lame", "-b:a", "192k",
                       str(out_path),
                   ]
                   rc2, _, err2 = self._spawn(mp3_cmd, timeout=60)
                   if rc2 == 0 and out_path.exists():
                       temp_wav.unlink(missing_ok=True)
                       LOGGER.info("F5-TTS audio generated: %s", out_path)
                   else:
                       LOGGER.warning("FFmpeg MP3 conversion failed (%s); keeping WAV.", err2)
                       temp_wav.rename(out_path.with_suffix(".wav"))
                       out_path = out_path.with_suffix(".wav")
               else:
                   temp_wav.rename(out_path.with_suffix(".wav"))
                   out_path = out_path.with_suffix(".wav")
           except Exception as exc:
               LOGGER.error("F5-TTS exception: %s", exc)
               return self._audio_fallback(script_text, out_path)
       else:
           return {"success": False, "error": f"Audio provider '{provider}' not supported."}

       # ── Generate timestamps via local Whisper ──
       timestamps_path = out_path.with_suffix(".timestamps.json")
       ts_script = _SCRIPT_DIR / "generate_timestamps.py"

       if ts_script.exists():
           ts_cmd = [
               sys.executable, str(ts_script),
               "--audio", str(out_path),
               "--out", str(timestamps_path),
               "--model", "base",
           ]
           try:
               rc3, _, err3 = self._spawn(ts_cmd, timeout=120)
               if rc3 == 0 and timestamps_path.exists():
                   LOGGER.info("Timestamps generated: %s", timestamps_path)
               else:
                   LOGGER.warning("Timestamp generation failed: %s", err3)
           except Exception as exc:
               LOGGER.warning("Timestamp generation exception: %s", exc)
       else:
           LOGGER.info("generate_timestamps.py not found at %s; skipping.", ts_script)

       return {
           "success": True,
           "output_audio": str(out_path),
           "timestamps": str(timestamps_path) if timestamps_path.exists() else None,
       }

  def _audio_fallback(self, script_text: str, out_path: Path) -> Dict[str, Any]:
       """Graceful stub when local voice cloning is unavailable."""
       try:
           out_path.write_text(
               f"# AUDIO STUB\nProvider: f5_tts_mlx (not installed)\n\nScript:\n{script_text}",
               encoding="utf-8",
           )
           LOGGER.info("Wrote audio stub to %s", out_path)
           return {"success": True, "output_audio": str(out_path), "note": "stub — voice engine not available"}
       except Exception as e:
           LOGGER.error("Failed to write audio fallback: %s", e)
           return {"success": False, "error": str(e)}

# ── CLI entrypoint ─────────────────────────────────────────────────────
def main(argv: Optional[List[str]] = None) -> int:
  parser = argparse.ArgumentParser(
      description="Sovereign Orchestrator — Multi-turn self-healing runner & gateway bridge"
  )
  subs = parser.add_subparsers(dest="mode", required=True)

  # 1. self-heal
  ph = subs.add_parser("self-heal", help="Generate → Test → Heal loop.")
  ph.add_argument("target", type=Path, help="File or directory to mutate.")
  ph.add_argument("--test-cmd", required=True, help='Test invocation (e.g. "pytest tests/ -v").')
  ph.add_argument("--root", type=Path, default=Path.cwd(), help="Project root.")
  ph.add_argument("--provider", default=os.getenv("ACTIVE_LLM_PROVIDER", "local"))
  ph.add_argument("--max-turns", type=int, default=MAX_HEALING_TURNS)
  ph.add_argument("--system-prompt", default=None)
  ph.add_argument("--shell", action="store_true", help="Execute test-cmd through system shell.")

  # 2. ast-index
  pa = subs.add_parser("ast-index", help="Index codebase.")
  pa.add_argument("target", type=Path)
  pa.add_argument("-o", "--output", type=Path, default=None)

  # 4. generate-audio
  p_audio = subs.add_parser("generate-audio", help="Generate audio from text.")
  p_audio.add_argument("--script", required=True, help="The text script to synthesize.")
  p_audio.add_argument("--out", type=Path, required=True, help="Output path for the audio file.")
  p_audio.add_argument("--tone", default="casual", help="Voice tone to use (casual, energetic, serious, surprised).")
  p_audio.add_argument("--provider", default="f5_tts_mlx", help="The audio generation provider (default: f5_tts_mlx).")

  args = parser.parse_args(argv)

  logging.basicConfig(
      level=logging.INFO,
      format="%(asctime)s %(name)s %(levelname)s %(message)s",
      stream=sys.stderr,
  )

  orch = SovereignOrchestrator(provider=getattr(args, "provider", None))

  if args.mode == "ast-index":
      orch.run_ast_index(args.target.resolve(), args.output)
      return 0

  if args.mode == "self-heal":
      res = orch.run_self_healing(
          target=args.target.resolve(),
          test_cmd=shlex.split(args.test_cmd),
          project_root=args.root.resolve(),
          max_turns=args.max_turns,
          system_prompt=args.system_prompt,
          use_shell=args.shell,
      )
      # JSON payload to stdout for VS Code extension parsing
      print(json.dumps(asdict(res), indent=2))
      return 0 if res.success else 1

  return 1


if __name__ == "__main__":
  sys.exit(main())