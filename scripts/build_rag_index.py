"""Build (or rebuild) the RAG vector store from docs_to_import/.

Usage:
    python scripts/build_rag_index.py           # build if not yet built
    python scripts/build_rag_index.py --rebuild  # wipe and rebuild from scratch

The output is saved to storage/vectorstore/documents.json.
On subsequent application starts the index is loaded directly from that file,
so no document processing occurs at startup.
"""

import argparse
import sys
import time
from pathlib import Path

# ── Resolve project root and add src/ to path ────────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SRC_DIR = PROJECT_ROOT / "src"
DOCS_DIR = PROJECT_ROOT / "docs_to_import"
STORE_FILE = PROJECT_ROOT / "storage" / "vectorstore" / "documents.json"

sys.path.insert(0, str(SRC_DIR))

# ── Supported extensions (must match simple_rag.py) ──────────────────────────
SUPPORTED_EXTENSIONS = {".txt", ".md", ".pdf", ".csv"}


def _count_files(folder: Path) -> int:
    return sum(
        1 for f in folder.rglob("*") if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def main():
    parser = argparse.ArgumentParser(description="Build RAG index from docs_to_import/")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Delete existing index and rebuild from scratch",
    )
    args = parser.parse_args()

    # ── Validate docs directory ───────────────────────────────────────────────
    if not DOCS_DIR.exists():
        print(f"[ERROR] docs_to_import directory not found: {DOCS_DIR}")
        sys.exit(1)

    file_count = _count_files(DOCS_DIR)
    print("=" * 60)
    print("RAG Index Builder")
    print("=" * 60)
    print(f"  Source   : {DOCS_DIR}")
    print(f"  Output   : {STORE_FILE}")
    print(f"  Files    : {file_count} supported files found")

    # ── Skip if already built (unless --rebuild) ──────────────────────────────
    if STORE_FILE.exists() and not args.rebuild:
        import json

        try:
            with open(STORE_FILE, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            existing = len(data.get("documents", {}))
        except Exception:
            existing = 0

        print(f"\n[OK] Index already exists ({existing} documents).")
        print("     Use --rebuild to wipe and re-process everything.")
        print("=" * 60)
        return

    # ── Delete stale index when rebuilding ───────────────────────────────────
    if args.rebuild and STORE_FILE.exists():
        STORE_FILE.unlink()
        print("\n[INFO] Existing index deleted — rebuilding from scratch...")

    # ── Load RAG config and initialise SimpleRAG ─────────────────────────────
    # Temporarily change cwd to src/ so relative paths inside SimpleRAG resolve
    import os

    original_cwd = os.getcwd()
    os.chdir(SRC_DIR)

    try:
        from rag.config_simple import RAGConfig  # type: ignore[import]
        from rag.simple_rag import SimpleRAG  # type: ignore[import]

        config = RAGConfig.from_env()
        # Override storage path to always use absolute project path
        config.storage_path = STORE_FILE.parent

        print("\n[INFO] Initialising RAG engine and importing documents…")
        t0 = time.time()

        # SimpleRAG.__init__ → _load_documents → _auto_import_or_fallback
        # Since STORE_FILE was deleted (or never existed), it will auto-import.
        rag = SimpleRAG(config)

        elapsed = time.time() - t0
        total_docs = len(rag.documents)
        total_chunks = sum(len(c) for c in rag.document_chunks.values())

        print(f"\n[OK] Index built successfully in {elapsed:.1f}s")
        print(f"     Documents : {total_docs}")
        print(f"     Chunks    : {total_chunks}")
        print(f"     Saved to  : {STORE_FILE}")
        print("=" * 60)

    finally:
        os.chdir(original_cwd)


if __name__ == "__main__":
    main()
