"""Resolução das respostas do checklist para chaves estáveis.

A CAUSA RAIZ DO RELATÓRIO DE 2026-11-19

As respostas chegam ao `/ask` num dicionário cujas chaves são o TEXTO DA
PERGUNTA, e o gerador as lia com `answers.get("texto exato...")`. O texto
estava duplicado em quatro arquivos e os quatro divergiram: **7 das 14
respostas eram descartadas em silêncio**.

Três itens do relatório não eram defeito da regra, mas da regra nunca ser
criada:

  - "as expressões regulares não estão sendo validadas"
  - "mesmo definindo valores categóricos [...] não há verificação alguma"
  - "nenhuma data é identificada como o tipo correto"

Os testes abaixo fixam que qualquer redação em uso no repositório resolve, e
que divergências futuras não voltam a descartar resposta em silêncio.
"""

import re

import pytest

from src.dsl_parser import questions as Q

RAIZ_FRONTEND = "frontend/src/pages/QaChecklist.js"


def perguntas_do_frontend():
    """Lê as perguntas direto do componente React.

    Comparar contra o arquivo real, e não contra uma cópia no teste, é o que
    faz este teste falhar quando frontend e backend divergirem de novo —
    exatamente o acidente que causou o defeito.
    """
    with open(RAIZ_FRONTEND, encoding="utf-8") as fh:
        js = fh.read()
    inicio = js.index("const QUESTIONS = {")
    bloco = js[inicio : js.index("};", inicio) + 2]
    textos = re.findall(r'"((?:[^"\\]|\\.)*)"', bloco)
    return [t.replace('\\\\', '\\').replace('\\"', '"') for t in textos if len(t) > 25]


class TestAlinhamentoEntreCamadas:
    def test_toda_pergunta_do_frontend_resolve(self):
        frontend = perguntas_do_frontend()
        resolvidas, desconhecidas = Q.resolver_respostas({t: "x" for t in frontend})
        assert desconhecidas == [], (
            "pergunta do frontend que o backend não reconhece — a resposta "
            "seria descartada em silêncio"
        )
        assert len(resolvidas) == len(frontend)

    def test_toda_pergunta_do_chatbot_resolve(self):
        from src.chatbot.questions import QUESTIONS as CHAT

        textos = [q for secao in CHAT.values() for q in secao]
        _, desconhecidas = Q.resolver_respostas({t: "x" for t in textos})
        assert desconhecidas == []

    def test_frontend_e_backend_tem_a_mesma_quantidade_de_perguntas(self):
        from src.chatbot.questions import QUESTIONS as CHAT

        chat = [q for secao in CHAT.values() for q in secao]
        assert len(perguntas_do_frontend()) == len(chat) == len(Q.QUESTIONS)

    def test_redacoes_antigas_do_sample_answers_continuam_resolvendo(self):
        """Compatibilidade: clientes antigos não podem parar de funcionar."""
        from utilities.sample_answers import SAMPLE_ANSWERS

        _, desconhecidas = Q.resolver_respostas(dict.fromkeys(SAMPLE_ANSWERS, "x"))
        assert desconhecidas == []


class TestToleranciaDeRedacao:
    """As diferenças reais que descartavam respostas, uma a uma."""

    @pytest.mark.parametrize(
        "variante,esperado",
        [
            # exemplo acrescentado ao enunciado
            (
                "What is the name of the dataset you want to validate?",
                Q.DATASET_NAME,
            ),
            (
                "What is the name of the dataset you want to validate? (e.g., customer_data)",
                Q.DATASET_NAME,
            ),
            # exemplo ampliado
            (
                "What is the format of the data (e.g., CSV, JSON, Parquet)?",
                Q.DATASET_FORMAT,
            ),
            (
                "What is the format of the data (e.g., CSV, JSON, Parquet, Delta)?",
                Q.DATASET_FORMAT,
            ),
            # ordem do exemplo trocada — foi o que perdeu os tipos declarados
            (
                "What is the expected data type for each column "
                "(e.g., string, integer, float, date)? Please list them in the same "
                "order as column names, separated by commas.",
                Q.COLUMN_TYPES,
            ),
            (
                "What is the expected data type for each column "
                "(e.g., integer, string, float, date)? Please list them in the same "
                "order as column names, separated by commas. (e.g., integer, string)",
                Q.COLUMN_TYPES,
            ),
            # instrução de formatação acrescentada — perdeu regex e categóricos
            (
                "Are there any columns that should match a specific regular "
                "expression pattern?",
                Q.REGEX_PATTERNS,
            ),
            (
                "Are there any columns that should match a specific regular "
                "expression pattern? List as 'column:pattern', separated by commas.",
                Q.REGEX_PATTERNS,
            ),
            (
                "Are there any columns that should only contain values from a "
                "specific set (e.g., a list of categories)?",
                Q.VALUE_SETS,
            ),
            # dica curta entre parênteses
            ("Does the data have a header?", Q.HAS_HEADER),
            ("Does the data have a header? (yes/no)", Q.HAS_HEADER),
        ],
    )
    def test_variante_resolve_para_a_chave_certa(self, variante, esperado):
        resolvidas, desconhecidas = Q.resolver_respostas({variante: "valor"})
        assert desconhecidas == []
        assert resolvidas == {esperado: "valor"}

    def test_chave_estavel_e_aceita_diretamente(self):
        """Um cliente novo pode mandar a chave, sem depender do texto."""
        resolvidas, _ = Q.resolver_respostas({Q.REGEX_PATTERNS: "id:^X$"})
        assert resolvidas[Q.REGEX_PATTERNS] == "id:^X$"


class TestFalhaVisivel:
    def test_pergunta_irreconhecivel_e_relatada_em_vez_de_descartada(self):
        """Silêncio foi o que tornou o defeito original invisível por meses."""
        _, desconhecidas = Q.resolver_respostas({"Qual a cor do cavalo branco?": "x"})
        assert desconhecidas == ["Qual a cor do cavalo branco?"]

    def test_resposta_ignorada_vira_aviso_no_dsl(self):
        from src.dsl_parser.generator import generate_dsl

        dsl = generate_dsl({"pergunta inexistente": "valor"})
        tipos = [w["type"] for w in dsl.get("warnings", [])]
        assert "unknown_question" in tipos


class TestIntegridadeDoRegistro:
    def test_enunciados_nao_colidem(self):
        """Duas perguntas com o mesmo enunciado normalizado mandariam a
        resposta para a regra errada — pior que descartá-la."""
        normalizados = [Q.normalizar(q.text) for q in Q.QUESTIONS]
        assert len(set(normalizados)) == len(normalizados)

    def test_toda_chave_e_unica(self):
        chaves = [q.key for q in Q.QUESTIONS]
        assert len(set(chaves)) == len(chaves)

    def test_normalizar_tolera_entrada_vazia(self):
        assert Q.normalizar("") == ""
        assert Q.normalizar(None) == ""
