#!/usr/bin/env python3
import json
import sys
import os
import re
from pathlib import Path

# Add Blueprints directory to Python path
sys.path.insert(0, str(Path(__file__).resolve().parent / "Blueprints"))
import app as blueprints_app

def main():
    queue_dir = Path("queue")
    files = sorted(queue_dir.glob("*.json"))
    if not files:
        print("Queue is empty.")
        sys.exit(0)

    # Process up to 10 files
    batch_files = files[:10]
    print(f"Processing {len(batch_files)} emails from the queue...")

    parts = []
    for f in batch_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            parts.append(
                f"Sender: {data.get('sender', '')}\n"
                f"Subject: {data.get('subject', '')}\n"
                f"Body:\n{data.get('body', '')}\n---"
            )
        except Exception as e:
            print(f"Error reading {f.name}: {e}", file=sys.stderr)
            sys.exit(1)

    combined_content = "\n".join(parts)
    
    # Read email_results.md to see what is in it and determine batch number
    results_path = Path("email_results.md")
    results_content = ""
    if results_path.exists():
        results_content = results_path.read_text(encoding="utf-8")

    # Count occurrences of "## Batch" to determine batch number
    batch_headers = re.findall(r"## Batch\s+(\d+)", results_content)
    if batch_headers:
        last_batch_num = int(batch_headers[-1])
        # Check if there is already content under the last header
        last_header_str = f"## Batch {last_batch_num}"
        header_idx = results_content.rfind(last_header_str)
        sub_content = results_content[header_idx + len(last_header_str):].strip()
        if not sub_content:
            batch_num = last_batch_num
        else:
            batch_num = last_batch_num + 1
    else:
        batch_num = 1

    total_batches = 12 # 112 / 10 is 12 batches
    batch_prompt = (
        f"Analyze the following batch of newsletters (Batch {batch_num} of {total_batches}):\n"
        f"{combined_content}"
    )

    print(f"Calling Gemini with model fallback for Batch {batch_num}...")
    batch_text = blueprints_app._call_gemini_with_fallback(batch_prompt)
    if not batch_text:
        print(f"Error: Batch {batch_num} processing failed (all models exhausted).", file=sys.stderr)
        sys.exit(1)

    # Write results to email_results.md
    start_email = (batch_num - 1) * 10 + 1
    end_email = start_email + len(batch_files) - 1
    
    # Prepare the output
    output_to_append = f"\n\n{batch_text}\n"
    
    # If we are filling in the existing batch header
    if batch_headers and batch_num == last_batch_num:
        new_content = results_content.rstrip() + output_to_append
    else:
        new_header = f"\n\n## Batch {batch_num} (emails {start_email}-{end_email})"
        new_content = results_content.rstrip() + new_header + output_to_append

    results_path.write_text(new_content, encoding="utf-8")
    print(f"Successfully appended batch {batch_num} results to email_results.md")

    # Delete successfully processed files
    for f in batch_files:
        f.unlink()
    print(f"Removed {len(batch_files)} processed files from the queue.")

if __name__ == "__main__":
    main()
