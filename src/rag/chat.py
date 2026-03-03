"""Chat functionality using RAG."""

from typing import Dict, Generator, List

from llama_index.core.chat_engine import CondensePlusContextChatEngine
from llama_index.core.llms import ChatMessage, MessageRole

from .config import RAGConfig
from .ingest import DocumentIngestor

# System prompt template
SYSTEM_PROMPT = """You are a helpful AI assistant with access to documentation \
about data quality testing and validation.
When answering questions, use the provided context and cite your sources with [1], [2], etc.
If there is no relevant context, inform the user you are answering based on general knowledge.
Keep your answers focused and relevant to the question.
Be helpful and provide practical examples when possible."""


class ChatEngine:
    """Handles chat interactions with RAG context."""

    def __init__(self, config: RAGConfig, ingestor: DocumentIngestor):
        """Initialize chat engine.

        Args:
            config: RAG configuration
            ingestor: Document ingestor instance
        """
        self.config = config
        self.ingestor = ingestor

        # Initialize chat engine with retriever
        self.chat_engine = CondensePlusContextChatEngine.from_defaults(
            retriever=self.ingestor.get_retriever(config.top_k),
            system_prompt=SYSTEM_PROMPT,
        )

        # Track conversation history
        self.chat_history: List[ChatMessage] = []

    def _format_response(self, response_text: str, source_nodes: List[Dict]) -> Dict:
        """Format chat response with citations.

        Args:
            response_text: Raw response text
            source_nodes: Source nodes used for response

        Returns:
            Dict with response text and citation metadata
        """
        citations = []
        for i, node in enumerate(source_nodes):
            citations.append(
                {
                    "id": i + 1,
                    "text": node["text"][:200] + "...",  # Preview
                    "metadata": node["metadata"],
                }
            )

        return {"text": response_text, "citations": citations}

    def chat(self, message: str, stream: bool = True) -> Generator[Dict, None, None] | Dict:
        """Send message to chat engine and get response.

        Args:
            message: User message
            stream: Whether to stream response tokens

        Returns:
            Generator of response tokens or complete response dict
        """
        # Add user message to history
        self.chat_history.append(ChatMessage(role=MessageRole.USER, content=message))

        # Get response
        if stream:
            # Stream response tokens
            response_gen = self.chat_engine.stream_chat(
                message, chat_history=self.chat_history[:-1]
            )

            last_response = None
            for response in response_gen:
                last_response = response
                if response.delta:
                    yield {"type": "token", "content": response.delta}

            # Add complete response to history
            if last_response:
                self.chat_history.append(
                    ChatMessage(role=MessageRole.ASSISTANT, content=last_response.response)
                )

                # Send citation data
                yield {
                    "type": "citations",
                    "content": self._format_response(
                        last_response.response, last_response.source_nodes
                    ),
                }

        else:
            # Get complete response
            response = self.chat_engine.chat(message, chat_history=self.chat_history[:-1])

            # Add to history
            self.chat_history.append(
                ChatMessage(role=MessageRole.ASSISTANT, content=response.response)
            )

            # Return formatted response
            return self._format_response(response.response, response.source_nodes)

    def clear_history(self) -> None:
        """Clear conversation history."""
        self.chat_history = []
