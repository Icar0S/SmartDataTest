"""/api/rag/chat-stream pela rota real: cabeçalhos e fluxo de bytes.

Complementa tests/backend/unit/test_chat_stream_heartbeat.py, que exercita o
gerador isolado. Aqui a requisição passa pelo Flask inteiro — blueprint,
rate limiter, autenticação e montagem da Response — e o que se verifica é o
que de fato trafega pelo soquete.

O QUE SÓ APARECE NESTE NÍVEL

1. `Content-Type: text/event-stream`. Se virasse JSON, o navegador esperaria
   a resposta inteira e os batimentos não serviriam para nada.
2. `X-Accel-Buffering: no`. Sem ele, um proxy com buffer segura os batimentos
   e entrega tudo junto no fim — anulando a correção sem quebrar nenhum teste
   de unidade.
3. A resposta precisa ser enviada em pedaços (`buffered=False`), e não
   materializada de uma vez.
"""

import json
import time

import pytest


@pytest.fixture
def rag_module():
    from rag import routes_simple

    return routes_simple


@pytest.fixture
def motor_controlavel(rag_module):
    """Troca o motor de chat e o intervalo de batimento; restaura ao final.

    Restaurar importa: o `app` do conftest tem escopo de sessão, então um
    motor falso deixado para trás contaminaria qualquer outro teste que
    tocasse o RAG depois deste arquivo.
    """
    original_engine = rag_module.chat_engine
    # getattr com padrão: numa versão sem batimento o atributo não existe, e a
    # fixture erraria no setup. O teste tem de chegar à asserção e falhar
    # dizendo "nenhum batimento", que é o diagnóstico útil.
    original_hb = getattr(rag_module, "_HEARTBEAT_S", None)

    def configurar(fn, heartbeat_s=0.05):
        rag_module.chat_engine = type("FakeEngine", (), {"chat": staticmethod(fn)})()
        rag_module._HEARTBEAT_S = heartbeat_s

    yield configurar

    rag_module.chat_engine = original_engine
    if original_hb is None:
        rag_module.__dict__.pop("_HEARTBEAT_S", None)
    else:
        rag_module._HEARTBEAT_S = original_hb


def _frames(resposta):
    """Lê a resposta em pedaços, devolvendo (instante, frame) de cada um."""
    inicio = time.monotonic()
    buffer = ""
    saida = []
    for pedaco in resposta.response:
        buffer += pedaco.decode() if isinstance(pedaco, bytes) else pedaco
        partes = buffer.split("\n\n")
        buffer = partes.pop()
        for parte in partes:
            saida.append((time.monotonic() - inicio, parte + "\n\n"))
    return saida


class TestCabecalhos:
    def test_content_type_e_event_stream(self, client, motor_controlavel):
        motor_controlavel(lambda _m: {"response": "ok", "citations": []})

        r = client.post(
            "/api/rag/chat-stream", json={"message": "oi"}, buffered=False
        )
        assert r.status_code == 200
        assert r.mimetype == "text/event-stream"
        list(r.response)

    def test_desliga_o_buffer_do_proxy(self, client, motor_controlavel):
        """X-Accel-Buffering: no.

        É o cabeçalho que impede um proxy intermediário de acumular a resposta
        e entregá-la de uma vez. Sem ele os batimentos saem do Flask mas não
        chegam ao navegador, e o 524 volta sem nenhum teste reclamar.
        """
        motor_controlavel(lambda _m: {"response": "ok", "citations": []})

        r = client.post(
            "/api/rag/chat-stream", json={"message": "oi"}, buffered=False
        )
        assert r.headers.get("X-Accel-Buffering") == "no"
        list(r.response)

    def test_cache_desligado(self, client, motor_controlavel):
        motor_controlavel(lambda _m: {"response": "ok", "citations": []})

        r = client.post(
            "/api/rag/chat-stream", json={"message": "oi"}, buffered=False
        )
        assert r.headers.get("Cache-Control") == "no-cache"
        list(r.response)


class TestFluxoNaRotaReal:
    def test_primeiro_byte_chega_antes_da_resposta_do_modelo(
        self, client, motor_controlavel
    ):
        """O caso que derrubava a demo, medido ponta a ponta.

        O modelo leva 0,4s; o primeiro byte tem de sair muito antes disso.
        Em produção o modelo leva até 300s e o limite da Cloudflare é 100s.
        """
        motor_controlavel(
            lambda _m: (time.sleep(0.4), {"response": "pronto", "citations": []})[1]
        )

        r = client.post(
            "/api/rag/chat-stream", json={"message": "oi"}, buffered=False
        )
        frames = _frames(r)

        assert frames, "a resposta não trouxe nenhum frame"
        instante_primeiro, primeiro = frames[0]
        assert primeiro.startswith(":"), "o primeiro frame deve ser um batimento"
        assert instante_primeiro < 0.2, (
            f"primeiro byte em {instante_primeiro:.3f}s com o modelo levando 0,4s"
        )

    def test_resposta_completa_chega_depois_dos_batimentos(
        self, client, motor_controlavel
    ):
        motor_controlavel(
            lambda _m: (
                time.sleep(0.25),
                {"response": "uma resposta", "citations": [{"id": 1}]},
            )[1]
        )

        r = client.post(
            "/api/rag/chat-stream", json={"message": "oi"}, buffered=False
        )
        frames = [f for _, f in _frames(r)]

        assert any(f.startswith(":") for f in frames), "nenhum batimento"

        dados = [f for f in frames if f.startswith("data:")]
        payloads = [
            json.loads(f[5:].strip()) for f in dados if "[DONE]" not in f
        ]
        tokens = "".join(p["content"] for p in payloads if p["type"] == "token")
        assert tokens.strip() == "uma resposta"
        assert dados[-1].strip() == "data: [DONE]"

    def test_erro_do_modelo_chega_como_frame_e_nao_derruba_a_conexao(
        self, client, motor_controlavel
    ):
        def quebrado(_m):
            raise RuntimeError("ollama indisponível")

        motor_controlavel(quebrado)

        r = client.post(
            "/api/rag/chat-stream", json={"message": "oi"}, buffered=False
        )
        assert r.status_code == 200, (
            "a falha acontece depois dos cabeçalhos; o status já foi enviado"
        )

        frames = [f for _, f in _frames(r)]
        erros = [
            json.loads(f[5:].strip())
            for f in frames
            if f.startswith("data:") and "[DONE]" not in f
        ]
        assert len(erros) == 1
        assert erros[0]["type"] == "error"


class TestValidacao:
    def test_mensagem_vazia_devolve_400_sem_abrir_stream(
        self, client, motor_controlavel
    ):
        """Pergunta vazia é erro de requisição, não de stream: devolve JSON
        com 400, para o frontend classificá-la como falha de servidor e não
        ficar esperando frames que nunca vêm."""
        chamado = {"n": 0}

        def contar(_m):
            chamado["n"] += 1
            return {"response": "", "citations": []}

        motor_controlavel(contar)

        r = client.post("/api/rag/chat-stream", json={"message": ""})
        assert r.status_code == 400
        assert r.mimetype == "application/json"
        assert chamado["n"] == 0, "o modelo não deve ser acionado sem pergunta"
