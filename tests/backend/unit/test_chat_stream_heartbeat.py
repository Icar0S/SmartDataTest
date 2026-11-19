"""Batimentos do /api/rag/chat-stream enquanto o modelo pensa.

POR QUE ESTES TESTES EXISTEM

O endpoint anuncia `text/event-stream`, mas o streaming era aparente: o
gerador chamava `chat_engine.chat()`, que bloqueia até a resposta INTEIRA
ficar pronta, e só então fatiava o texto em "tokens". O primeiro byte só
saía quando o modelo terminava.

A Cloudflare desiste de esperar o primeiro byte da origem em 100 segundos e
devolve 524 ao navegador. Medido no log do Ollama desta máquina (222
respostas): mediana 29s, p90 177s — **16% passam de 100s**. Uma em cada seis
perguntas virava "erro de conexão" na tela com o servidor trabalhando
normalmente.

O que estes testes travam:

1. o primeiro byte sai ANTES de o modelo responder (o que elimina o 524);
2. os batimentos continuam durante toda a espera;
3. o batimento é um comentário SSE, que o cliente ignora por definição do
   protocolo — se alguém trocar `: ping` por um frame `data:`, o frontend
   passa a renderizar lixo no meio da resposta e o teste quebra;
4. erro do modelo continua virando um frame de erro, não uma exceção que
   derruba a conexão no meio.
"""

import json
import threading
import time

import pytest


@pytest.fixture
def chat_stream_module(monkeypatch):
    """Importa o módulo de rotas com um motor de chat controlável.

    O import de `rag.routes_simple` constrói SimpleRAG e SimpleChatEngine no
    nível do módulo, o que lê a base de conhecimento do disco. Para um teste
    de unidade do gerador isso é lento e irrelevante, então o motor é
    substituído depois do import.
    """
    from rag import routes_simple

    return routes_simple


def _coletar(gerador, limite=10.0):
    """Consome o gerador registrando QUANDO cada frame saiu."""
    inicio = time.monotonic()
    frames = []
    for frame in gerador:
        frames.append((time.monotonic() - inicio, frame))
        if time.monotonic() - inicio > limite:
            pytest.fail("gerador não terminou dentro do limite do teste")
    return frames


def _montar_gerador(modulo, resposta_fn, heartbeat_s=0.05):
    """Monta o gerador real da rota, com o motor e o intervalo trocados."""
    from flask import Flask

    monkey_engine = type("FakeEngine", (), {"chat": staticmethod(resposta_fn)})()
    modulo.chat_engine = monkey_engine
    modulo._HEARTBEAT_S = heartbeat_s

    app = Flask(__name__)
    with app.test_request_context(
        "/api/rag/chat-stream",
        method="POST",
        json={"message": "pergunta"},
    ):
        resposta = modulo.chat_stream.__wrapped__()
        return resposta.response


class TestPrimeiroByte:
    """O que impede o 524 da Cloudflare."""

    def test_primeiro_byte_sai_antes_de_o_modelo_responder(self, chat_stream_module):
        """Com o modelo levando 0,5s, o primeiro frame tem de sair quase em zero.

        É a asserção central: antes da correção, o primeiro byte só aparecia
        junto com a resposta completa.
        """
        liberado = threading.Event()

        def lento(_mensagem):
            liberado.wait(timeout=5)
            return {"response": "resposta", "citations": []}

        gerador = _montar_gerador(chat_stream_module, lento)

        inicio = time.monotonic()
        primeiro = next(iter(gerador))
        atraso = time.monotonic() - inicio

        assert atraso < 0.2, (
            f"primeiro byte levou {atraso:.3f}s; com o modelo bloqueado isso "
            "significa que o gerador voltou a esperar a resposta inteira"
        )
        assert primeiro.startswith(":"), "o primeiro frame deve ser um comentário SSE"

        liberado.set()
        list(gerador)  # drena, para a thread não ficar pendurada

    def test_batimentos_continuam_durante_toda_a_espera(self, chat_stream_module):
        """Um batimento só no início não bastaria: a Cloudflare também corta
        conexões ociosas no meio. Com espera de ~0,35s e intervalo de 0,05s,
        vários batimentos têm de sair antes da resposta."""

        def lento(_mensagem):
            time.sleep(0.35)
            return {"response": "ok", "citations": []}

        frames = _coletar(_montar_gerador(chat_stream_module, lento))
        batimentos = [f for _, f in frames if f.startswith(":")]

        assert len(batimentos) >= 3, (
            f"apenas {len(batimentos)} batimento(s) em 0,35s de espera com "
            "intervalo de 0,05s"
        )

    def test_resposta_rapida_nao_enche_o_fluxo_de_batimentos(self, chat_stream_module):
        """O batimento é seguro de rede, não ruído: com o modelo respondendo
        na hora, sai apenas o batimento inicial."""

        frames = _coletar(
            _montar_gerador(
                chat_stream_module,
                lambda _m: {"response": "curta", "citations": []},
            )
        )
        batimentos = [f for _, f in frames if f.startswith(":")]
        assert len(batimentos) == 1


class TestFormatoSSE:
    """O batimento precisa ser invisível para o cliente."""

    def test_batimento_e_comentario_e_nao_frame_de_dados(self, chat_stream_module):
        """`: ping` é comentário SSE; o cliente o descarta por definição.

        Se alguém "melhorar" isto para `data: {"type":"ping"}`, o frontend
        passa a tratá-lo como conteúdo — este teste é o que avisa.
        """

        def lento(_mensagem):
            time.sleep(0.12)
            return {"response": "ok", "citations": []}

        frames = [f for _, f in _coletar(_montar_gerador(chat_stream_module, lento))]
        batimentos = [f for f in frames if not f.startswith("data:")]

        assert batimentos, "nenhum batimento foi emitido"
        for frame in batimentos:
            assert frame.startswith(": "), f"batimento mal formado: {frame!r}"
            assert frame.endswith("\n\n"), "todo frame SSE termina em linha em branco"
            assert "data:" not in frame, "batimento não pode carregar dados"

    def test_resposta_completa_mantem_tokens_citacoes_e_done(self, chat_stream_module):
        """A correção não pode ter alterado o contrato com o frontend."""

        frames = [
            f
            for _, f in _coletar(
                _montar_gerador(
                    chat_stream_module,
                    lambda _m: {
                        "response": "duas palavras",
                        "citations": [{"id": 1, "text": "trecho"}],
                    },
                )
            )
        ]
        dados = [f for f in frames if f.startswith("data:")]
        payloads = [json.loads(f[5:].strip()) for f in dados if "[DONE]" not in f]

        tokens = [p["content"] for p in payloads if p["type"] == "token"]
        assert "".join(tokens).strip() == "duas palavras"

        citacoes = [p for p in payloads if p["type"] == "citations"]
        assert len(citacoes) == 1
        assert citacoes[0]["content"]["citations"][0]["id"] == 1

        assert dados[-1].strip() == "data: [DONE]"


class TestFalhas:
    """O erro do modelo tem de chegar como frame, não como conexão cortada."""

    def test_excecao_do_modelo_vira_frame_de_erro(self, chat_stream_module):
        def quebrado(_mensagem):
            raise RuntimeError("ollama fora do ar")

        frames = [f for _, f in _coletar(_montar_gerador(chat_stream_module, quebrado))]
        erros = [
            json.loads(f[5:].strip())
            for f in frames
            if f.startswith("data:") and "[DONE]" not in f
        ]

        assert len(erros) == 1
        assert erros[0]["type"] == "error"
        assert "ollama fora do ar" in erros[0]["content"]

    def test_excecao_do_modelo_nao_interrompe_o_gerador(self, chat_stream_module):
        """O gerador tem de terminar normalmente depois do frame de erro.

        Se a exceção escapasse, o cliente veria a conexão morrer no meio e o
        navegador reportaria falha de rede — exatamente o diagnóstico errado
        que esta investigação começou tentando desfazer.
        """

        def quebrado(_mensagem):
            raise ValueError("falha interna")

        gerador = _montar_gerador(chat_stream_module, quebrado)
        list(gerador)  # não deve levantar
