"""RAG document ingestion and processing."""

import uuid
from pathlib import Path
from typing import Dict, List, Optional

from llama_index.core import (
    Document,
    Settings,
    StorageContext,
    VectorStoreIndex,
    load_index_from_storage,
)
from llama_index.core.node_parser import SimpleNodeParser

from .config import RAGConfig


class DocumentIngestor:
    """Handles document ingestion and indexing for RAG."""

    def __init__(self, config: RAGConfig):
        """Initialize the document ingestor.

        Args:
            config: RAG configuration object
        """
        self.config = config
        self.storage_path = Path(config.storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)

        # Configure global settings - usando configuração simples por enquanto
        # Settings.embed_model = OpenAIEmbedding(api_key=config.llm_api_key)
        # Settings.llm = Anthropic(api_key=config.llm_api_key, model=config.llm_model)
        Settings.node_parser = SimpleNodeParser.from_defaults(
            chunk_size=config.chunk_size, chunk_overlap=config.chunk_overlap
        )

        # Load or create index
        try:
            storage_context = StorageContext.from_defaults(persist_dir=str(self.storage_path))
            self.index = load_index_from_storage(storage_context)
        except Exception:  # pylint: disable=broad-exception-caught
            self.index = VectorStoreIndex([])

    def add_document(self, content: str, metadata: Dict) -> str:
        """Add a document to the index.

        Args:
            content: Document text content
            metadata: Document metadata (filename, size, etc)

        Returns:
            str: Document ID
        """
        doc_id = str(uuid.uuid4())
        metadata["doc_id"] = doc_id

        document = Document(text=content, metadata=metadata)

        self.index.insert(document)
        self.save_index()

        return doc_id

    def get_retriever(self, top_k: Optional[int] = None):
        """Get a retriever for the index.

        Args:
            top_k: Number of documents to retrieve

        Returns:
            Retriever object
        """
        if top_k is None:
            top_k = self.config.top_k

        return self.index.as_retriever(similarity_top_k=top_k)

    def save_index(self):
        """Persist the index to storage."""
        self.index.storage_context.persist(persist_dir=str(self.storage_path))

    def load_documents_from_files(self, file_paths: List[Path]) -> List[str]:
        """Load documents from files.

        Args:
            file_paths: List of file paths to load

        Returns:
            List of document IDs
        """
        doc_ids = []

        for file_path in file_paths:
            try:
                content = self._extract_text_from_file(file_path)
                metadata = {
                    "filename": file_path.name,
                    "filepath": str(file_path),
                    "size": file_path.stat().st_size,
                }

                doc_id = self.add_document(content, metadata)
                doc_ids.append(doc_id)

            except Exception as e:  # pylint: disable=broad-exception-caught
                print(f"Error loading {file_path}: {e}")
                continue

        return doc_ids

    def _extract_text_from_file(self, file_path: Path) -> str:
        """Extract text content from a file.

        Args:
            file_path: Path to the file

        Returns:
            str: Extracted text content
        """
        suffix = file_path.suffix.lower()

        if suffix == ".txt":
            return file_path.read_text(encoding="utf-8")
        if suffix == ".md":
            return file_path.read_text(encoding="utf-8")
        if suffix == ".pdf":
            # For PDF files, we'll use the built-in readers
            from llama_index.readers.file import (
                PDFReader,  # pylint: disable=import-outside-toplevel
            )

            reader = PDFReader()
            docs = reader.load_data(file_path)
            return "\n".join([doc.text for doc in docs])
        if suffix == ".csv":
            import pandas as pd  # pylint: disable=import-outside-toplevel

            df = pd.read_csv(file_path)
            return df.to_string()
        raise ValueError(f"Unsupported file type: {suffix}")

    def get_document_sources(self) -> List[Dict]:
        """Get information about all indexed documents.

        Returns:
            List of document metadata
        """
        sources = []

        # Get all document nodes from the index
        retriever = self.get_retriever(top_k=1000)  # Get all documents
        nodes = retriever.retrieve("")  # Empty query to get all

        for node in nodes:
            if hasattr(node, "metadata"):
                sources.append(
                    {
                        "id": node.metadata.get("doc_id", "unknown"),
                        "filename": node.metadata.get("filename", "unknown"),
                        "filepath": node.metadata.get("filepath", "unknown"),
                        "size": node.metadata.get("size", 0),
                    }
                )

        return sources

    def delete_document(self, doc_id: str) -> bool:
        """Delete a document from the index.

        Args:
            doc_id: Document ID to delete

        Returns:
            bool: True if deleted, False if not found
        """
        # This is a simplified implementation
        # In a production system, you'd want proper document deletion
        try:
            self.index.delete_ref_doc(doc_id)
            self.save_index()
            return True
        except Exception:  # pylint: disable=broad-exception-caught
            return False
