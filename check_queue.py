#!/usr/bin/env python3
from pathlib import Path

queue_dir = Path("queue")
files = list(queue_dir.glob("*.json"))
print(f"Queue count: {len(files)}")
if files:
    print("First 5 files:")
    for f in files[:5]:
        print(f"  {f.name}")
