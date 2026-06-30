#!/usr/bin/env python3
from pathlib import Path
queue_dir = Path("queue")
files = list(queue_dir.glob("*.json"))
with open("queue_count.txt", "w") as f:
    f.write(f"Queue count: {len(files)}\n")
    if files:
        f.write("First 5 files:\n")
        for file in files[:5]:
            f.write(f"  {file.name}\n")
print(f"Queue count: {len(files)}")
