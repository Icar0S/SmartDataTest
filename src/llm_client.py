"""LLM client abstraction layer supporting multiple providers."""

import os
from abc import ABC, abstractmethod
from typing import Dict, List, Optional


class LLMClient(ABC):
    """Abstract base class for LLM clients."""

    @abstractmethod
    def generate(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Generate text from messages.

        Args:
            messages: List of message dicts with 'role' and 'content'
            system: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Temperature for generation (0.0-1.0)

        Returns:
            Generated text response
        """
        pass


class AnthropicClient(LLMClient):
    """Client for Anthropic Claude API."""

    def __init__(self, api_key: str, model: str = "claude-3-haiku-20240307"):
        """Initialize Anthropic client.

        Args:
            api_key: Anthropic API key
            model: Model name to use
        """
        try:
            import anthropic

            self.client = anthropic.Anthropic(api_key=api_key)
            self.model = model
        except ImportError as e:
            raise ImportError(
                "anthropic package not installed. Install with: pip install anthropic"
            ) from e

    def generate(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Generate text using Claude API."""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                temperature=temperature,
                system=system if system else "",
                messages=messages,
            )
            return response.content[0].text
        except Exception as e:
            raise RuntimeError(f"Anthropic API error: {e}") from e


class OllamaClient(LLMClient):
    """Client for Ollama local LLM."""

    def __init__(
        self,
        model: str = "qwen2.5-coder:7b",
        base_url: str = "http://localhost:11434",
    ):
        """Initialize Ollama client.

        Args:
            model: Model name to use (e.g., 'qwen2.5-coder:7b', 'llama3')
            base_url: Base URL for Ollama API
        """
        try:
            import ollama

            self.client = ollama.Client(host=base_url)
            self.model = model
        except ImportError as e:
            raise ImportError(
                "ollama package not installed. Install with: pip install ollama"
            ) from e

    def generate(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Generate text using Ollama API."""
        try:
            # Ollama expects messages in a specific format
            # Add system message if provided
            formatted_messages = []
            if system:
                formatted_messages.append({"role": "system", "content": system})
            formatted_messages.extend(messages)

            # Ollama API call
            response = self.client.chat(
                model=self.model,
                messages=formatted_messages,
                options={
                    "temperature": temperature,
                    "num_predict": max_tokens,
                },
            )

            return response["message"]["content"]
        except Exception as e:
            raise RuntimeError(f"Ollama API error: {e}") from e


class GeminiClient(LLMClient):
    """Client for Google Gemini API."""

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash-lite"):
        """Initialize Gemini client.

        Args:
            api_key: Google Gemini API key
            model: Model name to use (e.g., 'gemini-2.5-flash-lite', 'gemini-2.5-pro')
                  Will auto-add 'models/' prefix if not present
        """
        try:
            import google.generativeai as genai

            genai.configure(api_key=api_key)
            # Add models/ prefix if not present
            if not model.startswith("models/"):
                model = f"models/{model}"
            self.model = genai.GenerativeModel(model)
            self.model_name = model
        except ImportError as e:
            raise ImportError(
                "google-generativeai package not installed. Install with: pip install google-generativeai"
            ) from e

    def generate(
        self,
        messages: List[Dict[str, str]],
        system: Optional[str] = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> str:
        """Generate text using Gemini API."""
        try:
            # Gemini uses a different format - build conversation
            conversation = []
            if system:
                conversation.append(f"System: {system}\n")

            # Format messages
            for msg in messages:
                role = msg.get("role", "user")
                content = msg.get("content", "")
                if role == "user":
                    conversation.append(f"User: {content}")
                elif role == "assistant":
                    conversation.append(f"Assistant: {content}")

            prompt = "\n".join(conversation)

            # Configure generation
            generation_config = {
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            }

            # Generate response
            response = self.model.generate_content(prompt, generation_config=generation_config)

            # Handle blocked or empty responses
            if not response.text:
                # Check if response was blocked
                if hasattr(response, "prompt_feedback"):
                    feedback = response.prompt_feedback
                    if hasattr(feedback, "block_reason"):
                        raise RuntimeError(f"Content blocked: {feedback.block_reason}")
                raise RuntimeError("Empty response from Gemini")

            return response.text
        except Exception as e:
            raise RuntimeError(f"Gemini API error: {e}") from e


def create_llm_client(
    provider: Optional[str] = None,
    api_key: Optional[str] = None,
    model: Optional[str] = None,
    base_url: Optional[str] = None,
) -> LLMClient:
    """Factory function to create LLM client based on configuration.

    Args:
        provider: LLM provider ('anthropic', 'gemini', or 'ollama'). If None, reads from LLM_PROVIDER env var
        api_key: API key for Anthropic/Gemini. If None, reads from LLM_API_KEY or GEMINI_API_KEY env var
        model: Model name. If None, reads from LLM_MODEL or GEMINI_MODEL env var
        base_url: Base URL for Ollama. If None, reads from OLLAMA_BASE_URL env var

    Returns:
        Configured LLM client instance

    Raises:
        ValueError: If provider is invalid or required config is missing
    """
    # Get configuration from environment if not provided
    provider = provider or os.getenv("LLM_PROVIDER", "ollama")
    provider = provider.lower()

    if provider == "anthropic":
        api_key = api_key or os.getenv("LLM_API_KEY")
        if not api_key:
            raise ValueError("Anthropic API key is required. Set LLM_API_KEY environment variable.")
        model = model or os.getenv("LLM_MODEL", "claude-3-haiku-20240307")
        return AnthropicClient(api_key=api_key, model=model)

    elif provider == "gemini":
        api_key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("LLM_API_KEY")
        if not api_key:
            raise ValueError("Gemini API key is required. Set GEMINI_API_KEY environment variable.")
        model = (
            model or os.getenv("GEMINI_MODEL") or os.getenv("LLM_MODEL", "gemini-2.5-flash-lite")
        )
        return GeminiClient(api_key=api_key, model=model)

    elif provider == "ollama":
        model = model or os.getenv("LLM_MODEL", "qwen2.5-coder:7b")
        base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        return OllamaClient(model=model, base_url=base_url)

    else:
        raise ValueError(
            f"Invalid LLM provider: {provider}. Must be 'anthropic', 'gemini', or 'ollama'."
        )


def get_default_llm_client() -> Optional[LLMClient]:
    """Get default LLM client based on environment configuration.

    Returns:
        LLM client instance or None if configuration is invalid
    """
    try:
        return create_llm_client()
    except (ValueError, ImportError) as e:
        print(f"[WARNING] Could not initialize LLM client: {e}")
        return None
