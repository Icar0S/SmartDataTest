"""Configuration for RAG system."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class RAGConfig:
    """Configuration for RAG system.

    Args:
        storage_path: Path to store vector index
        llm_provider: LLM provider ('anthropic' or 'ollama')
        llm_api_key: API key for LLM provider (required for Anthropic)
        llm_model: Name of LLM model to use
        ollama_base_url: Base URL for Ollama API
        embed_model: Name of embedding model
        chunk_size: Size of text chunks for indexing
        chunk_overlap: Overlap between chunks
        top_k: Number of chunks to retrieve
        max_upload_mb: Maximum upload file size in MB
        allowed_file_types: List of allowed file extensions
    """

    storage_path: Path = Path("./storage/vectorstore")
    llm_provider: str = "ollama"
    llm_api_key: str = ""
    llm_model: str = "qwen2.5-coder:7b"
    ollama_base_url: str = "http://localhost:11434"
    embed_model: str = "text-embedding-3-small"
    chunk_size: int = 512
    chunk_overlap: int = 50
    top_k: int = 4
    max_upload_mb: int = 10
    allowed_file_types: List[str] = field(default_factory=lambda: [".pdf", ".txt", ".md", ".csv"])

    @classmethod
    def from_env(cls) -> "RAGConfig":
        """Create config from environment variables."""
        import os

        from dotenv import load_dotenv

        load_dotenv()

        # Determine provider and default model
        provider = os.getenv("LLM_PROVIDER", "ollama")
        default_model = "qwen2.5-coder:7b" if provider == "ollama" else "claude-3-haiku-20240307"

        return cls(
            storage_path=Path(os.getenv("VECTOR_STORE_PATH", "./storage/vectorstore")),
            llm_provider=provider,
            llm_api_key=os.getenv("LLM_API_KEY", ""),
            llm_model=os.getenv("LLM_MODEL", default_model),
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            embed_model=os.getenv("EMBED_MODEL", "text-embedding-3-small"),
            chunk_size=int(os.getenv("CHUNK_SIZE", "512")),
            chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "50")),
            top_k=int(os.getenv("TOP_K", "4")),
            max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "10")),
            allowed_file_types=os.getenv("ALLOWED_FILE_TYPES", ".pdf,.txt,.md,.csv").split(","),
        )
