"""Simple RAG implementation using basic vector search."""

try:
    import fcntl

    _HAS_FCNTL = True
except ImportError:  # Windows does not have fcntl
    _HAS_FCNTL = False
import json
import uuid
from pathlib import Path
from typing import Dict, List, Optional

# Supported file types for auto-import
_AUTO_IMPORT_EXTENSIONS = {".txt", ".md", ".pdf"}


class SimpleRAG:
    """Simple RAG implementation without complex dependencies."""

    def __init__(self, config):
        """Initialize simple RAG."""
        self.config = config
        self.storage_path = Path(config.storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        # Simple in-memory storage for documents
        self.documents = {}
        self.document_chunks = {}

        # Load existing documents
        self._load_documents()

    def _load_documents(self):
        """Load documents from storage, auto-import from docs_to_import, or use fallback."""
        docs_file = self.storage_path / "documents.json"
        if docs_file.exists():
            self._load_from_file(docs_file)
        else:
            print(f"[WARNING] Documents file not found: {docs_file}")
            self._auto_import_or_fallback_with_lock()

    def _load_from_file(self, docs_file: Path):
        """Load documents from a JSON file."""
        try:
            with open(docs_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self.documents = data.get("documents", {})
                self.document_chunks = data.get("chunks", {})
                # Rebuild missing chunks from document content
                for doc_id, doc_data in self.documents.items():
                    if doc_id not in self.document_chunks:
                        content = doc_data.get("content", "")
                        self.document_chunks[doc_id] = self._create_chunks(content)
                print(f"[OK] Loaded {len(self.documents)} documents from file")
        except Exception as e:  # pylint: disable=broad-exception-caught
            print(f"[WARNING] Error loading documents: {e}")
            self._auto_import_or_fallback()

    def _auto_import_or_fallback_with_lock(self):
        """Run auto-import with an exclusive file lock so only one worker imports.

        When multiple gunicorn workers start simultaneously and documents.json is
        absent, this prevents each worker from independently re-importing all PDFs.
        The first worker acquires the lock and runs the import; every subsequent
        worker waits, then loads from the file that the first worker saved.
        """
        docs_file = self.storage_path / "documents.json"
        lock_file = self.storage_path / "documents.lock"
        if not _HAS_FCNTL:
            # Windows: no file-locking available, import without lock
            self._auto_import_or_fallback()
            return
        try:
            with open(lock_file, "w") as lock_fd:
                fcntl.flock(lock_fd.fileno(), fcntl.LOCK_EX)  # type: ignore[name-defined]
                try:
                    # Double-check: another worker may have written the file while
                    # we were waiting for the lock.
                    if docs_file.exists():
                        print("[INFO] documents.json created by another worker; loading from file")
                        self._load_from_file(docs_file)
                    else:
                        self._auto_import_or_fallback()
                finally:
                    fcntl.flock(lock_fd.fileno(), fcntl.LOCK_UN)  # type: ignore[name-defined]
        except OSError as e:
            # fcntl not available (e.g., Windows dev environment) – proceed without lock
            print(f"[WARNING] File lock unavailable ({e}); importing without lock")
            self._auto_import_or_fallback()

    def _auto_import_or_fallback(self):
        """Try auto-importing from docs_to_import folder; fall back to hardcoded docs."""
        docs_dir = self._find_docs_to_import()
        if docs_dir is not None:
            print(f"[INFO] Auto-importing documents from {docs_dir}...")
            self._auto_import_from_folder(docs_dir)
        else:
            print("[INFO] docs_to_import folder not found. Loading fallback documents...")
            self._load_fallback_documents()

    def _find_docs_to_import(self) -> Optional[Path]:
        """Locate the docs_to_import directory relative to common project layouts."""
        candidates = [
            Path("docs_to_import"),  # cwd/docs_to_import
            Path("../docs_to_import"),  # one level up (e.g. src/)
            Path(__file__).parent.parent.parent / "docs_to_import",  # project root
        ]
        for candidate in candidates:
            try:
                resolved = candidate.resolve()
                if resolved.is_dir():
                    return resolved
            except Exception:  # pylint: disable=broad-exception-caught
                pass
        return None

    def _extract_text_from_file(self, file_path: Path) -> Optional[str]:
        """Extract plain text from a supported file."""
        suffix = file_path.suffix.lower()
        if suffix in {".txt", ".md"}:
            for encoding in ("utf-8", "latin-1", "cp1252"):
                try:
                    return file_path.read_text(encoding=encoding)
                except UnicodeDecodeError:
                    continue
        elif suffix == ".pdf":
            try:
                import PyPDF2  # pylint: disable=import-outside-toplevel

                text_parts = []
                with open(file_path, "rb") as fh:
                    reader = PyPDF2.PdfReader(fh)
                    for page in reader.pages:
                        text = page.extract_text()
                        if text:
                            text_parts.append(text)
                return "\n".join(text_parts) if text_parts else None
            except ImportError:
                print("[WARNING] PyPDF2 not installed; PDF files cannot be imported.")
            except Exception as e:  # pylint: disable=broad-exception-caught
                print(f"[WARNING] Could not read PDF {file_path.name}: {e}")
        return None

    def _auto_import_from_folder(self, folder: Path):
        """Import all supported documents from folder into the RAG system.

        Files whose filename is already present in the index are skipped so that
        calling this method more than once (e.g., via the /api/rag/ingest endpoint
        after dropping new PDFs into docs_to_import) never creates duplicates.
        """
        # Build set of filenames already in the index
        existing_filenames = {
            doc.get("metadata", {}).get("filename") for doc in self.documents.values()
        }

        imported = 0
        skipped = 0
        for file_path in sorted(folder.rglob("*")):
            if not file_path.is_file():
                continue
            if file_path.suffix.lower() not in _AUTO_IMPORT_EXTENSIONS:
                continue
            if file_path.name in existing_filenames:
                skipped += 1
                continue
            try:
                content = self._extract_text_from_file(file_path)
                if not content or not content.strip():
                    continue
                doc_id = str(uuid.uuid4())
                metadata = {
                    "filename": file_path.name,
                    "filepath": str(file_path),
                    "size": file_path.stat().st_size,
                    "source": "docs_to_import",
                }
                self.documents[doc_id] = {
                    "content": content,
                    "metadata": metadata,
                    "id": doc_id,
                }
                self.document_chunks[doc_id] = self._create_chunks(content)
                imported += 1
                print(f"[OK] Imported: {file_path.name}")
            except Exception as e:  # pylint: disable=broad-exception-caught
                print(f"[WARNING] Failed to import {file_path.name}: {e}")

        if skipped:
            print(f"[INFO] Skipped {skipped} already-indexed document(s)")

        if imported > 0:
            print(f"[OK] Auto-imported {imported} documents from docs_to_import")
            self._save_documents()
        elif skipped == 0:
            # Nothing imported and nothing skipped means the folder had no usable content
            print("[WARNING] No documents imported from docs_to_import. Loading fallbacks.")
            self._load_fallback_documents()

    def _load_fallback_documents(self):
        """Load fallback documents when file is missing."""
        try:
            from .fallback_docs import FALLBACK_DOCUMENTS

            print("[INFO] Loading fallback documents...")
            for doc_id, doc_data in FALLBACK_DOCUMENTS.items():
                self.documents[doc_id] = doc_data
                # Create chunks for fallback docs
                chunks = self._create_chunks(doc_data["content"])
                self.document_chunks[doc_id] = chunks

            print(f"[OK] Loaded {len(self.documents)} fallback documents")
        except Exception as e:  # pylint: disable=broad-exception-caught
            print(f"[ERROR] Failed to load fallback documents: {e}")

    def _save_documents(self):
        """Save documents to storage."""
        docs_file = self.storage_path / "documents.json"
        try:
            with open(docs_file, "w", encoding="utf-8") as f:
                json.dump(
                    {"documents": self.documents, "chunks": self.document_chunks},
                    f,
                    indent=2,
                    ensure_ascii=False,
                )
        except Exception as e:  # pylint: disable=broad-exception-caught
            print(f"Error saving documents: {e}")

    def add_document(self, content: str, metadata: Dict) -> str:
        """Add a document to the RAG system."""
        doc_id = str(uuid.uuid4())

        # Store document
        self.documents[doc_id] = {
            "content": content,
            "metadata": metadata,
            "id": doc_id,
        }

        # Create chunks
        chunks = self._create_chunks(content)
        self.document_chunks[doc_id] = chunks

        # Save to storage
        self._save_documents()

        return doc_id

    def _create_chunks(self, text: str) -> List[Dict]:
        """Create simple text chunks."""
        chunks = []
        words = text.split()

        # Simple chunking by word count
        chunk_size_words = self.config.chunk_size // 4  # Rough estimate
        overlap_words = self.config.chunk_overlap // 4

        for i in range(0, len(words), chunk_size_words - overlap_words):
            chunk_words = words[i : i + chunk_size_words]
            chunk_text = " ".join(chunk_words)

            chunks.append(
                {
                    "text": chunk_text,
                    "start_idx": i,
                    "end_idx": min(i + chunk_size_words, len(words)),
                }
            )

        return chunks

    def search(self, query: str, top_k: Optional[int] = None) -> List[Dict]:
        """Simple keyword-based search."""
        if top_k is None:
            top_k = self.config.top_k

        results = []
        query_words = set(query.lower().split())

        for doc_id, chunks in self.document_chunks.items():
            doc_metadata = self.documents[doc_id]["metadata"]

            for chunk in chunks:
                chunk_words = set(chunk["text"].lower().split())

                # Simple similarity score based on word overlap
                overlap = len(query_words.intersection(chunk_words))
                if overlap > 0:
                    score = overlap / len(query_words.union(chunk_words))

                    results.append(
                        {
                            "text": chunk["text"],
                            "score": score,
                            "doc_id": doc_id,
                            "metadata": doc_metadata,
                        }
                    )

        # Sort by score and return top results
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def get_sources(self) -> List[Dict]:
        """Get information about all documents."""
        return [
            {
                "id": doc_id,
                "filename": doc["metadata"].get("filename", "unknown"),
                "size": doc["metadata"].get("size", 0),
            }
            for doc_id, doc in self.documents.items()
        ]

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document."""
        if doc_id in self.documents:
            del self.documents[doc_id]
            if doc_id in self.document_chunks:
                del self.document_chunks[doc_id]
            self._save_documents()
            return True
        return False

    def import_new_documents(self) -> Dict:
        """Scan docs_to_import for files not yet in the index and import them.

        Returns:
            Dict with keys ``imported`` (count of new docs) and
            ``total`` (total docs after import).
        """
        docs_dir = self._find_docs_to_import()
        if docs_dir is None:
            return {
                "imported": 0,
                "total": len(self.documents),
                "error": "docs_to_import folder not found",
            }

        before = len(self.documents)
        self._auto_import_from_folder(docs_dir)
        imported = len(self.documents) - before
        return {"imported": imported, "total": len(self.documents)}
