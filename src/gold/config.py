"""Configuration for GOLD Dataset Testing module."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import List


@dataclass
class GoldConfig:
    """Configuration for GOLD Dataset Testing feature.

    Args:
        storage_path: Path to store uploaded files and results
        max_upload_mb: Maximum upload file size in MB
        allowed_file_types: List of allowed file extensions
        max_rows_warn: Warning threshold for large datasets
        request_timeout: Maximum request timeout in seconds
    """

    storage_path: Path = Path("./storage/gold")
    max_upload_mb: int = 50
    allowed_file_types: List[str] = field(
        default_factory=lambda: [".csv", ".xlsx", ".xls", ".parquet"]
    )
    max_rows_warn: int = 500_000
    request_timeout: int = 300

    @classmethod
    def from_env(cls) -> "GoldConfig":
        """Create config from environment variables."""
        import os

        from dotenv import load_dotenv

        load_dotenv()

        # Get storage path and make it absolute
        storage_path = os.getenv("GOLD_STORAGE_PATH", "./storage/gold")
        if not os.path.isabs(storage_path):
            # Make it relative to the project root
            project_root = Path(__file__).parent.parent.parent
            storage_path = project_root / storage_path

        return cls(
            storage_path=Path(storage_path),
            max_upload_mb=int(os.getenv("MAX_UPLOAD_MB", "50")),
            allowed_file_types=os.getenv(
                "GOLD_ALLOWED_FILE_TYPES", ".csv,.xlsx,.xls,.parquet"
            ).split(","),
            max_rows_warn=int(os.getenv("MAX_ROWS_WARN", "500000")),
            request_timeout=int(os.getenv("GOLD_REQUEST_TIMEOUT", "300")),
        )
