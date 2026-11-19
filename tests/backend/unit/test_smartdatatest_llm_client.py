"""SmartDataTestLLMClient against a fake transport: no network involved."""

import sys
from pathlib import Path

import pytest

# Add src to path
sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "src"))

import llm_client  # noqa: E402
from llm_client import SmartDataTestLLMClient, create_llm_client  # noqa: E402


class FakeResponse:
    def __init__(self, status_code, body=None, headers=None):
        self.status_code = status_code
        self.ok = status_code < 400
        self.headers = headers or {}
        self._body = body or {}
        self.text = str(self._body)

    def json(self):
        return self._body


def answer(content="ok", **extra):
    return FakeResponse(
        200, {"content": content, "model": "qwen2.5-coder:7b", "fallback_applied": False, **extra}
    )


@pytest.fixture
def sleeps(monkeypatch):
    """Records retry delays instead of sleeping."""
    delays = []
    monkeypatch.setattr(llm_client.time, "sleep", delays.append)
    return delays


def make_client(responses):
    client = SmartDataTestLLMClient(
        api_key="sk-test", model="qwen2.5-coder:7b", base_url="https://llm.example/", max_retries=2
    )
    calls = []

    def post(url, json, timeout):
        calls.append({"url": url, "json": json})
        return responses.pop(0)

    client.session.post = post
    return client, calls


def test_sends_the_model_and_system_prompt_and_returns_the_content(sleeps):
    client, calls = make_client([answer("Completude mede campos preenchidos.")])

    text = client.generate(
        [{"role": "user", "content": "O que é completude?"}],
        system="Responda em português.",
        max_tokens=200,
        temperature=0.3,
    )

    assert text == "Completude mede campos preenchidos."
    assert client.session.headers["Authorization"] == "Bearer sk-test"
    assert calls[0]["url"] == "https://llm.example/v1/chat"
    body = calls[0]["json"]
    assert body["model"] == "qwen2.5-coder:7b"
    assert body["messages"][0] == {"role": "system", "content": "Responda em português."}
    assert body["max_tokens"] == 200
    assert body["temperature"] == 0.3


def test_retries_a_full_queue_honouring_retry_after(sleeps):
    client, calls = make_client([FakeResponse(429, headers={"Retry-After": "7"}), answer()])

    assert client.generate([{"role": "user", "content": "oi"}]) == "ok"
    assert len(calls) == 2
    assert sleeps == [7.0]


def test_gives_up_after_the_last_retry(sleeps):
    client, calls = make_client([FakeResponse(503)] * 3)

    with pytest.raises(RuntimeError, match="HTTP 503"):
        client.generate([{"role": "user", "content": "oi"}])
    assert len(calls) == 3
    assert sleeps == [1.0, 2.0]


def test_does_not_retry_a_rejected_key(sleeps):
    client, calls = make_client([FakeResponse(401, {"detail": "invalid key"})])

    with pytest.raises(RuntimeError, match="HTTP 401"):
        client.generate([{"role": "user", "content": "oi"}])
    assert len(calls) == 1
    assert sleeps == []


def test_factory_reads_key_model_and_url_from_the_environment(monkeypatch):
    monkeypatch.setenv("LLM_API_KEY", "sk-env")
    monkeypatch.setenv("LLM_MODEL", "qwen3:8b")
    monkeypatch.setenv("LLM_API_BASE_URL", "https://llm.example")

    client = create_llm_client(provider="smartdatatest")

    assert isinstance(client, SmartDataTestLLMClient)
    assert client.model == "qwen3:8b"
    assert client.url == "https://llm.example/v1/chat"
    assert client.session.headers["Authorization"] == "Bearer sk-env"


def test_factory_requires_a_key(monkeypatch):
    monkeypatch.delenv("LLM_API_KEY", raising=False)

    with pytest.raises(ValueError, match="LLM_API_KEY"):
        create_llm_client(provider="smartdatatest")
