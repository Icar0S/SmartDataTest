"""Simple RAG configuration without complex dependencies."""

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class RAGConfig:
    """Simple RAG configuration."""

    storage_path: Path = Path("storage/vectorstore")
    chunk_size: int = 512
    chunk_overlap: int = 50
    top_k: int = 8
    max_upload_mb: int = 10
    allowed_file_types: List[str] = field(
        default_factory=lambda: [".pdf", ".txt", ".md", ".csv", ".docx"]
    )

    @classmethod
    def from_env(cls) -> "RAGConfig":
        """Create config from environment variables."""
        from dotenv import load_dotenv

        load_dotenv()

        # Get storage path and make it absolute if relative
        storage_path_str = os.getenv("VECTOR_STORE_PATH", "./storage/vectorstore")
        storage_path = Path(storage_path_str)

        # If path is relative and we're in src/, go up one level
        if not storage_path.is_absolute():
            # Check if we're in src/ directory
            current_dir = Path.cwd()
            if current_dir.name == "src":
                storage_path = current_dir.parent / storage_path
            else:
                storage_path = current_dir / storage_path

        return cls(
            storage_path=storage_path,
            chunk_size=int(os.getenv("CHUNK_SIZE", "512")),
            chunk_overlap=int(os.getenv("CHUNK_OVERLAP", "50")),
            top_k=int(os.getenv("TOP_K", "8")),
            max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "10")),
        )
