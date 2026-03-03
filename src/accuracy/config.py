"""Configuration for Data Accuracy module."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class AccuracyConfig:
    """Configuration for Data Accuracy feature.

    Args:
        storage_path: Path to store uploaded files and results
        max_upload_mb: Maximum upload file size in MB
        allowed_file_types: List of allowed file extensions
        max_rows: Maximum number of rows to process
        request_timeout: Maximum request timeout in seconds
    """

    storage_path: Path = Path("./storage")
    max_upload_mb: int = 50
    allowed_file_types: List[str] = field(default_factory=lambda: [".csv", ".xlsx", ".parquet"])
    max_rows: int = 2_000_000
    request_timeout: int = 120

    @classmethod
    def from_env(cls) -> "AccuracyConfig":
        """Create config from environment variables."""
        import os

        from dotenv import load_dotenv

        load_dotenv()

        # Get storage path and make it absolute
        storage_path = os.getenv("ACCURACY_STORAGE_PATH", "./storage")
        if not os.path.isabs(storage_path):
            # Make it relative to the project root, not the current directory
            # Assuming this file is in src/accuracy/config.py
            project_root = Path(__file__).parent.parent.parent
            storage_path = project_root / storage_path

        return cls(
            storage_path=Path(storage_path),
            max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "50")),
            allowed_file_types=os.getenv(
                "ACCURACY_ALLOWED_FILE_TYPES", ".csv,.xlsx,.parquet"
            ).split(","),
            max_rows=int(os.getenv("ACCURACY_MAX_ROWS", "2000000")),
            request_timeout=int(os.getenv("ACCURACY_REQUEST_TIMEOUT", "120")),
        )
