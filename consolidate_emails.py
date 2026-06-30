import os
import json

def consolidate_emails(queue_dir="./queue", output_file="./queue/consolidated_emails.json"):
    """
    Reads all JSON files in the specified queue directory, consolidates their content
    into a single list of dictionaries, and writes this list to a new JSON file.
    """
    all_emails = []
    for filename in os.listdir(queue_dir):
        if filename.endswith(".json") and filename != os.path.basename(output_file):
            filepath = os.path.join(queue_dir, filename)
            try:
                with open(filepath, "r") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        all_emails.extend(data)
                    else:
                        all_emails.append(data)
            except json.JSONDecodeError:
                print(f"Error decoding JSON from file: {filepath}")
            except Exception as e:
                print(f"An error occurred while reading {filepath}: {e}")

    try:
        with open(output_file, "w") as f:
            json.dump(all_emails, f, indent=4)
        print(f"Successfully consolidated emails to {output_file}")
    except Exception as e:
        print(f"An error occurred while writing to {output_file}: {e}")


if __name__ == "__main__":
    consolidate_emails()