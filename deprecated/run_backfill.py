#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent / "Blueprints"))
from backfill_history import backfill

result = backfill()
print("BACKFILL_RESULT:", result)
