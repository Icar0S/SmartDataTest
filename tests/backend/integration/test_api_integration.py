"""Integration test simulating frontend API calls."""

import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "src"))

# Import Flask app
from api import app  # type: ignore


def _run_api_workflow(csv_path):
    """Run complete API workflow like frontend does (call directly, not via pytest)."""
    client = app.test_client()

    print(f"\nTesting: {os.path.basename(csv_path)}")
    print("=" * 80)

    # Step 1: Upload and inspect
    print("\n[1] POST /api/datasets/inspect")
    with open(csv_path, "rb") as f:
        data = {
            "file": (f, os.path.basename(csv_path)),
            "header": "true",
            "sample_size": "10000",
        }
        response = client.post(
            "/api/datasets/inspect", data=data, content_type="multipart/form-data"
        )

    print(f"    Status: {response.status_code}")
    if response.status_code != 200:
        print(f"    ✗ ERROR: {response.get_json()}")
        return False

    metadata = response.get_json()
    print(f"    ✓ Rows: {metadata['row_count']}, Columns: {metadata['column_count']}")
    print(f"    Encoding: {metadata['detected_options'].get('encoding', 'N/A')}")
    print(f"    Delimiter: '{metadata['detected_options'].get('delimiter', 'N/A')}'")

    # Step 2: Generate DSL
    print("\n[2] POST /api/datasets/generate-dsl")
    response = client.post(
        "/api/datasets/generate-dsl",
        data=json.dumps({"metadata": metadata, "user_edits": {}}),
        content_type="application/json",
    )

    print(f"    Status: {response.status_code}")
    if response.status_code != 200:
        print(f"    ✗ ERROR: {response.get_json()}")
        return False

    dsl_response = response.get_json()
    dsl = dsl_response["dsl"]
    print("    ✓ DSL generated")
    print(f"    Rules: {len(dsl.get('rules', []))}")
    print(f"    Schema fields: {len(dsl.get('schema', []))}")

    # Step 3: Generate PySpark code
    print("\n[3] POST /api/datasets/generate-pyspark")
    response = client.post(
        "/api/datasets/generate-pyspark",
        data=json.dumps({"dsl": dsl}),
        content_type="application/json",
    )

    print(f"    Status: {response.status_code}")
    if response.status_code != 200:
        print(f"    ✗ ERROR: {response.get_json()}")
        return False

    pyspark_response = response.get_json()
    print("    ✓ PySpark code generated")
    print(f"    Filename: {pyspark_response['filename']}")
    print(f"    Code length: {len(pyspark_response['pyspark_code'])} chars")

    print(f"\n✓✓✓ COMPLETE SUCCESS for {os.path.basename(csv_path)} ✓✓✓")
    return True


if __name__ == "__main__":
    # Test files
    test_files = [
        r"C:\Users\Icaro\Downloads\arrecadacao-estado.csv",
        r"C:\Users\Icaro\Downloads\ALUNOS-DA-GRADUACAO-2025-1.csv",
    ]

    print("=" * 80)
    print("INTEGRATION TEST - Simulating Frontend API Calls")
    print("=" * 80)

    success_count = 0
    fail_count = 0

    for csv_path in test_files:
        if not os.path.exists(csv_path):
            print(f"\n⚠ File not found: {csv_path}")
            continue

        try:
            if _run_api_workflow(csv_path):
                success_count += 1
            else:
                fail_count += 1
        except Exception as e:
            print(f"\n✗✗✗ EXCEPTION for {os.path.basename(csv_path)} ✗✗✗")
            print(f"Error: {e}")
            import traceback

            traceback.print_exc()
            fail_count += 1

    print("\n" + "=" * 80)
    print("SUMMARY")
    print("=" * 80)
    print(f"✓ Success: {success_count}")
    print(f"✗ Failed: {fail_count}")
    print("=" * 80)
