"""SyntheticConfig picks the LLM model with the same precedence as llm_client."""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from src.synthetic.config import SyntheticConfig


def test_gemini_prefers_gemini_model_over_llm_model(monkeypatch):
    """A .env holding both the Ollama and the Gemini block.

    The RAG chat paired Gemini with GEMINI_MODEL while synthetic generation
    paired it with LLM_MODEL (an Ollama model), rejected the combination and
    silently returned mock rows.
    """
    monkeypatch.setenv("LLM_PROVIDER", "gemini")
    monkeypatch.setenv("LLM_MODEL", "qwen2.5-coder:7b")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

    config = SyntheticConfig.from_env()

    assert config.llm_provider == "gemini"
    assert config.llm_model == "gemini-2.5-flash-lite"


def test_ollama_keeps_llm_model(monkeypatch):
    monkeypatch.setenv("LLM_PROVIDER", "ollama")
    monkeypatch.setenv("LLM_MODEL", "qwen2.5-coder:7b")
    monkeypatch.setenv("GEMINI_MODEL", "gemini-2.5-flash-lite")

    config = SyntheticConfig.from_env()

    assert config.llm_provider == "ollama"
    assert config.llm_model == "qwen2.5-coder:7b"
