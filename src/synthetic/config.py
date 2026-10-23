"""Configuration for Synthetic Data Generation module."""

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class SyntheticConfig:
    """Configuration for Synthetic Data Generation feature.

    Args:
        storage_path: Path to store generated datasets
        llm_provider: LLM provider ('anthropic' or 'ollama')
        llm_provider_endpoint: Endpoint for LLM API (for Ollama)
        llm_api_key: API key for LLM provider (for Anthropic)
        llm_model: LLM model to use for generation
        ollama_base_url: Base URL for Ollama API
        max_rows: Maximum number of rows allowed
        request_timeout: Maximum request timeout in seconds
        max_mem_mb: Maximum memory usage in MB
        rate_limit: Rate limit in requests per minute
    """

    storage_path: Path = Path("./storage/synth")
    llm_provider: str = "ollama"
    llm_provider_endpoint: Optional[str] = None
    llm_api_key: str = ""
    llm_model: str = "qwen2.5-coder:7b"
    ollama_base_url: str = "http://localhost:11434"
    max_rows: int = 1_000_000
    request_timeout: int = 300
    max_mem_mb: int = 2048
    rate_limit: int = 60

    @classmethod
    def from_env(cls) -> "SyntheticConfig":
        """Create config from environment variables."""
        from dotenv import load_dotenv

        load_dotenv()

        # Get storage path and make it absolute
        storage_path = os.getenv("SYNTH_STORAGE_PATH", "./storage/synth")
        if not os.path.isabs(storage_path):
            # Make it relative to the project root
            project_root = Path(__file__).parent.parent.parent
            storage_path = project_root / storage_path

        # Determine provider and default model
        provider = os.getenv("LLM_PROVIDER", "ollama")

        # Set appropriate default model based on provider
        if provider == "ollama":
            default_model = "qwen2.5-coder:7b"
        elif provider == "gemini":
            default_model = "gemini-2.5-flash-lite"
        else:  # anthropic
            default_model = "claude-3-haiku-20240307"

        # Same precedence as llm_client.create_llm_client: for Gemini,
        # GEMINI_MODEL wins over LLM_MODEL. Reading LLM_MODEL first paired
        # provider "gemini" with an Ollama model whenever .env kept both
        # blocks, and generation silently fell back to mock rows.
        if provider == "gemini":
            configured_model = os.getenv("GEMINI_MODEL") or os.getenv("LLM_MODEL")
        else:
            configured_model = os.getenv("LLM_MODEL") or os.getenv("GEMINI_MODEL")

        # If no model specified, use default for provider
        model_to_use = configured_model or default_model

        # Smart detection: If a Gemini model is specified, ensure provider is set to gemini
        if model_to_use and model_to_use.startswith("gemini"):
            provider = "gemini"
            # Use GEMINI_API_KEY if LLM_API_KEY is not set
            api_key = os.getenv("LLM_API_KEY") or os.getenv("GEMINI_API_KEY", "")
        elif model_to_use and model_to_use.startswith("claude"):
            provider = "anthropic"
            api_key = os.getenv("LLM_API_KEY", "")
        else:
            api_key = os.getenv("LLM_API_KEY", "")

        return cls(
            storage_path=Path(storage_path),
            llm_provider=provider,
            llm_provider_endpoint=os.getenv("LLM_PROVIDER_ENDPOINT"),
            llm_api_key=api_key,
            llm_model=model_to_use,
            ollama_base_url=os.getenv("OLLAMA_BASE_URL", "http://localhost:11434"),
            max_rows=int(os.getenv("SYNTH_MAX_ROWS", "1000000")),
            request_timeout=int(os.getenv("SYNTH_REQUEST_TIMEOUT", "300")),
            max_mem_mb=int(os.getenv("SYNTH_MAX_MEM_MB", "2048")),
            rate_limit=int(os.getenv("SYNTH_RATE_LIMIT", "60")),
        )
