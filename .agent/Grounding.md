# Passaggio IDE — Grounding Document

## Mission
Passaggio IDE is a VS Code extension that serves as the sovereign development engine for the Passaggio agency. It orchestrates a swarm of AI agents to write, test, heal, and deploy code across a multi-LLM gateway (Vertex AI, Cohere, AI Studio, local Ollama/Hermes).

## Current Active Build Targets
1. **Agent Swarm sidebar** (`src/extension.ts`) — 5 specialized agent nodes with tree-data provider + webview chat
2. **Self-healing orchestrator** (`Blueprints/orchestrator.py`) — multi-turn generate → test → heal loop with AST awareness
3. **Unified LLM gateway** (`Blueprints/gateway.py`) — runtime routing across 4 provider families
4. **Studio video pipeline** (`Blueprints/app.py` + `Remotion-video/src/components/*`) — Streamlit UI → local inference → Remotion render → FFmpeg HLS packaging
5. **Telemetry & sandboxing** (`src/telemetry.ts`, AST index exports, desktop telemetry dumps)

## File/Folder Ignore List
- `Remotion-video/google-cloud-sdk/` — vendor SDK bundle (1,000+ files, zero relevance to extension logic)
- `Remotion-video/google-cloud-cli-*.tar.gz` — archived CLI installers
- `src/*.js` — compiled extension artifacts (read `src/*.ts` only)
- `src/*.js.map` — source maps
- `src/telemetry 1.*`, `src/telemetry 2.*` — stale duplicates
- `package-lock.json` — dependency lockfile
- `Blueprints/*.pyc`, `__pycache__/` — Python cache
- `storage/`, `temp_props.json`, `out/` — runtime output folders

## Dependency Map
- `package.json` → drives `src/extension.ts` activation events, commands, and views
- `src/extension.ts` → spawns `Blueprints/orchestrator.py` (via terminal subprocess)
- `Blueprints/orchestrator.py` → imports `gateway.py` + `ast_parser.py`
- `Blueprints/app.py` (Streamlit) → writes `temp_props.json` → consumed by `Remotion-video/src/index.ts`
- Component stack: `MyComposition.tsx` → imports `Watermark.tsx`, `ActiveCaptions.tsx`, `SplineAsset.tsx`, `AnimatedGraph.tsx`
- `.continue/config.yaml` (outside workspace) → supplies LLM credentials to both gateway and Continue.dev

## Ingest Protocol for New Files
When a new file appears in this workspace, classify it and update this doc in one of the "Active Build Targets" sections or add it to the Ignore List.
