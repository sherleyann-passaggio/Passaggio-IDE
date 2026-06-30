#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gateway.py
Unified Model Gateway — Sovereign Workstation
─────────────────────────────────────────────
Dynamically instantiates environmental credentials and API clients
for Google Cloud Vertex AI, Cohere SDK, Google AI Studio (Gemini),
and local Ollama / Hermes inference endpoints.

Exposed API
-----------
   gateway = UnifiedModelGateway.from_env()
   result = gateway.complete("Explain quantum error correction.", provider="vertex")
"""

from __future__ import annotations

import os
import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

# ---------------------------------------------------------------------------
# Soft imports — fail gracefully at runtime if an SDK is missing
# ---------------------------------------------------------------------------
try:
   import vertexai
   from vertexai.generative_models import GenerativeModel
   _HAS_VERTEXAI = True
except ModuleNotFoundError:
   _HAS_VERTEXAI = False

try:
   import cohere
   _HAS_COHERE = True
except ModuleNotFoundError:
   _HAS_COHERE = False

try:
   import google.generativeai as genai
   _HAS_GENAI = True
except ModuleNotFoundError:
   _HAS_GENAI = False

try:
   import requests
   _HAS_REQUESTS = True
except ModuleNotFoundError:
   _HAS_REQUESTS = False


LOGGER = logging.getLogger("UnifiedModelGateway")


@dataclass
class GatewayConfig:
   """
   Runtime credentials and hyper-parameters.
   Populated from VS Code workspace settings (via subprocess env) or a .env file.
   """

   # ── Google Cloud Vertex AI ─────────────────────────────────────────────
   vertex_project_id: Optional[str] = None
   vertex_location: Optional[str] = "us-central1"
   vertex_credentials_path: Optional[str] = None
   vertex_model: Optional[str] = "gemini-1.5-pro-002"

   # ── Cohere ─────────────────────────────────────────────────────────────
   cohere_api_key: Optional[str] = None
   cohere_model: Optional[str] = "command-r-plus"
   cohere_base_url: Optional[str] = "https://api.cohere.com/v1"

   # ── Google AI Studio (Gemini API) ──────────────────────────────────────
   ai_studio_api_key: Optional[str] = None
   ai_studio_model: Optional[str] = "gemini-1.5-pro-latest"

   # ── Local Ollama / Hermes ──────────────────────────────────────────────
   local_base_url: Optional[str] = "http://localhost:11434"
   local_model: Optional[str] = "hermes3"

   # ── Routing ────────────────────────────────────────────────────────────
   active_provider: Optional[str] = None
   default_temperature: float = 0.7
   default_max_tokens: int = 2048

   @classmethod
   def from_env(cls) -> "GatewayConfig":
       """Hydrate from standard shell environment variables."""
       return cls(
           vertex_project_id=os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("VERTEX_PROJECT_ID"),
           vertex_location=os.getenv("VERTEX_AI_LOCATION", "us-central1"),
           vertex_credentials_path=os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
           vertex_model=os.getenv("VERTEX_AI_MODEL", "gemini-1.5-pro-002"),
           cohere_api_key=os.getenv("COHERE_API_KEY"),
           cohere_model=os.getenv("COHERE_MODEL", "command-r-plus"),
           cohere_base_url=os.getenv("COHERE_BASE_URL", "https://api.cohere.com/v1"),
           ai_studio_api_key=os.getenv("GOOGLE_AI_STUDIO_API_KEY")
           or os.getenv("GEMINI_API_KEY")
           or os.getenv("AI_STUDIO_API_KEY"),
           ai_studio_model=os.getenv("AI_STUDIO_MODEL", "gemini-1.5-pro-latest"),
           local_base_url=os.getenv("LOCAL_LLM_BASE_URL", "http://localhost:11434"),
           local_model=os.getenv("LOCAL_LLM_MODEL", "hermes3"),
           active_provider=os.getenv("ACTIVE_LLM_PROVIDER"),
           default_temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
           default_max_tokens=int(os.getenv("LLM_MAX_TOKENS", "2048")),
       )


class UnifiedModelGateway:
   """
   Factory + router for multi-provider LLM access.
   Lazily initialises SDK clients on first use to avoid heavy imports
   during IDE startup.
   """

   def __init__(self, config: Optional[GatewayConfig] = None):
       self.cfg = config or GatewayConfig.from_env()
       self._clients: Dict[str, Any] = {}
       self.logger = LOGGER

   # -----------------------------------------------------------------------
   # Lazy client instantiation
   # -----------------------------------------------------------------------

   def _init_vertex(self) -> Any:
       if not _HAS_VERTEXAI:
           raise RuntimeError(
               "google-cloud-aiplatform is required for Vertex AI. "
               "Install:  pip install google-cloud-aiplatform"
           )
       if "vertex" in self._clients:
           return self._clients["vertex"]

       if self.cfg.vertex_credentials_path:
           os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(
               Path(self.cfg.vertex_credentials_path).expanduser().resolve()
           )

       vertexai.init(
           project=self.cfg.vertex_project_id,
           location=self.cfg.vertex_location,
       )
       model = GenerativeModel(self.cfg.vertex_model)
       self._clients["vertex"] = model
       self.logger.info(
           "Vertex AI initialised | project=%s location=%s model=%s",
           self.cfg.vertex_project_id,
           self.cfg.vertex_location,
           self.cfg.vertex_model,
       )
       return model

   def _init_cohere(self) -> Any:
       if not _HAS_COHERE:
           raise RuntimeError(
               "cohere SDK is required. Install:  pip install cohere"
           )
       if "cohere" in self._clients:
           return self._clients["cohere"]

       client = cohere.Client(
           api_key=self.cfg.cohere_api_key,
           base_url=self.cfg.cohere_base_url,
       )
       self._clients["cohere"] = client
       self.logger.info(
           "Cohere client initialised | model=%s base_url=%s",
           self.cfg.cohere_model,
           self.cfg.cohere_base_url,
       )
       return client

   def _init_ai_studio(self) -> Any:
       if not _HAS_GENAI:
           raise RuntimeError(
               "google-generativeai is required for AI Studio. "
               "Install:  pip install google-generativeai"
           )
       if "ai_studio" in self._clients:
           return self._clients["ai_studio"]

       genai.configure(api_key=self.cfg.ai_studio_api_key)
       model = genai.GenerativeModel(self.cfg.ai_studio_model)
       self._clients["ai_studio"] = model
       self.logger.info(
           "AI Studio initialised | model=%s",
           self.cfg.ai_studio_model,
       )
       return model

   def _init_local(self) -> Dict[str, str]:
       if not _HAS_REQUESTS:
           raise RuntimeError(
               "requests is required for local Ollama gateway. "
               "Install:  pip install requests"
           )
       if "local" in self._clients:
           return self._clients["local"]

       base = self.cfg.local_base_url.rstrip("/")
       self._clients["local"] = {"base_url": base}
       self.logger.info(
           "Local gateway initialised | base_url=%s model=%s",
           base,
           self.cfg.local_model,
       )
       return self._clients["local"]

   # -----------------------------------------------------------------------
   # Public routing API
   # -----------------------------------------------------------------------

   def complete(
       self,
       prompt: str,
       *,
       provider: Optional[str] = None,
       temperature: Optional[float] = None,
       max_tokens: Optional[int] = None,
       system: Optional[str] = None,
       **kwargs: Any,
   ) -> str:
       """
       Generate a text completion through the requested provider.

       Parameters
       ----------
       prompt: User message / instruction.
       provider: One of {'vertex', 'cohere', 'ai_studio', 'local'}.
                 Falls back to ``config.active_provider``.
       temperature: Sampling temperature (default from config).
       max_tokens: Maximum tokens to generate (default from config).
       system: Optional system prompt / preamble.
       **kwargs: Provider-specific generation arguments forwarded raw.

       Returns
       -------
       Generated text string.
       """
       prov = (provider or self.cfg.active_provider or "").lower()
       if not prov:
           raise ValueError(
               "No provider specified. Set ACTIVE_LLM_PROVIDER or pass provider=..."
           )

       temp = temperature if temperature is not None else self.cfg.default_temperature
       max_tok = max_tokens if max_tokens is not None else self.cfg.default_max_tokens

       if prov == "vertex":
           return self._generate_vertex(prompt, temp, max_tok, system, **kwargs)
       if prov == "cohere":
           return self._generate_cohere(prompt, temp, max_tok, system, **kwargs)
       if prov == "ai_studio":
           return self._generate_ai_studio(prompt, temp, max_tok, system, **kwargs)
       if prov in ("local", "ollama", "hermes"):
           return self._generate_local(prompt, temp, max_tok, system, **kwargs)

       raise ValueError(
           f"Unknown provider '{prov}'. Expected: vertex, cohere, ai_studio, local"
       )

   # -----------------------------------------------------------------------
   # Provider-specific generation internals
   # -----------------------------------------------------------------------

   def _generate_vertex(
       self,
       prompt: str,
       temperature: float,
       max_tokens: int,
       system: Optional[str],
       **kwargs: Any,
   ) -> str:
       model = self._init_vertex()

       if system:
           kwargs.setdefault("system_instruction", system)

       response = model.generate_content(
           prompt,
           generation_config={
               "temperature": temperature,
               "max_output_tokens": max_tokens,
               **kwargs.pop("generation_config", {}),
           },
           **kwargs,
       )
       if not response.candidates:
           return ""
       return response.text

   def _generate_cohere(
       self,
       prompt: str,
       temperature: float,
       max_tokens: int,
       system: Optional[str],
       **kwargs: Any,
   ) -> str:
       client = self._init_cohere()

       resp = client.chat(
           message=prompt,
           model=self.cfg.cohere_model,
           temperature=temperature,
           max_tokens=max_tokens,
           preamble=system,
           **kwargs,
       )
       return resp.text

   def _generate_ai_studio(
       self,
       prompt: str,
       temperature: float,
       max_tokens: int,
       system: Optional[str],
       **kwargs: Any,
   ) -> str:
       model = self._init_ai_studio()

       generation_config = {
           "temperature": temperature,
           "max_output_tokens": max_tokens,
           **kwargs.pop("generation_config", {}),
       }

       if system:
           kwargs.setdefault("system_instruction", system)

       response = model.generate_content(
           prompt,
           generation_config=generation_config,
           **kwargs,
       )
       return response.text

   def _generate_local(
       self,
       prompt: str,
       temperature: float,
       max_tokens: int,
       system: Optional[str],
       **kwargs: Any,
   ) -> str:
       client = self._init_local()
       url = f"{client['base_url']}/api/generate"

       payload = {
           "model": self.cfg.local_model,
           "prompt": prompt,
           "stream": False,
           "options": {
               "temperature": temperature,
               "num_predict": max_tokens,
               **kwargs.pop("options", {}),
           },
           **kwargs,
       }
       if system:
           payload["system"] = system

       r = requests.post(url, json=payload, timeout=120)
       r.raise_for_status()
       data = r.json()
       return data.get("response", "")

   # -----------------------------------------------------------------------
   # Diagnostics & utilities
   # -----------------------------------------------------------------------

   def health_check(self, provider: Optional[str] = None) -> Dict[str, Any]:
       """
       Probe every configured provider and report availability.
       """
       results: Dict[str, Any] = {}
       candidates = ["vertex", "cohere", "ai_studio", "local"]
       for prov in candidates:
           if provider and prov != provider:
               continue
           try:
               if prov == "vertex":
                   self._init_vertex()
               elif prov == "cohere":
                   self._init_cohere()
               elif prov == "ai_studio":
                   self._init_ai_studio()
               elif prov == "local":
                   self._init_local()
               results[prov] = {"status": "ok"}
           except Exception as exc:
               results[prov] = {"status": "error", "detail": str(exc)}
       return results

   def list_available_providers(self) -> List[str]:
       """Return providers whose SDK dependencies are presently installed."""
       avail = []
       if _HAS_VERTEXAI:
           avail.append("vertex")
       if _HAS_COHERE:
           avail.append("cohere")
       if _HAS_GENAI:
           avail.append("ai_studio")
       if _HAS_REQUESTS:
           avail.append("local")
       return avail


# ---------------------------------------------------------------------------
# CLI smoke test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
   import sys

   logging.basicConfig(
       level=logging.INFO,
       format="%(asctime)s | %(name)s | %(levelname)s | %(message)s",
   )

   gw = UnifiedModelGateway.from_env()
   print("Health check:", json.dumps(gw.health_check(), indent=2))
   print("SDKs installed:", gw.list_available_providers())

   if len(sys.argv) >= 3:
       prov, text = sys.argv[1], sys.argv[2]
       print(f"\n--- {prov} completion ---")
       try:
           out = gw.complete(text, provider=prov)
           print(out)
       except Exception as exc:
           print(f"Error: {exc}")
