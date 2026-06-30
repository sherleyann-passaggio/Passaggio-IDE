# Chat Snippet Ingestion

Place raw chat exports (from Claude, ChatGPT, etc.) here as `.md` files.
The parser turns them into structured intelligence for Phase 0/1 of the workflow.

## Expected Format

Each `.md` file should contain sections like:

```markdown
## Insight / Decision / Action Item
- **Topic**: ...
- **Key quote**: "..."
- **Impact**: ...
```

## Usage

```bash
python3 parse_snippets.py *.md > ../intelligence_ingest.json
```

The resulting JSON can be fed into `orchestrator.py` or `vidiq_bridge.py`
as a `--props-json` override for daily script generation.
