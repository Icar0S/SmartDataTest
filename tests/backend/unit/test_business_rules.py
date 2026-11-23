"""Regras de negócio calculadas: `Total_Spent = Price per Item * Quantity`.

Do relatório de 2026-11-19, dataset Retail Store Sales: *"não foi possível
modelar a regra de negócio Total_Spent = Price per Item * Quantity"*.

O checklist só sabia comparar uma coluna com OUTRA (`preco > custo`); não
havia aritmética. Regras assim — total = preço × quantidade, margem =
receita − custo — são o caso mais comum de qualidade de dados em vendas, e
eram justamente as que a ferramenta não alcançava.

A expressão do usuário vira código PySpark que ele executa, então ela é
COMPILADA e não interpolada: nome de coluna é resolvido contra o esquema
declarado e qualquer outra coisa é recusada antes de gerar código.
"""

import pytest

from src.dsl_parser.expressions import (
    ExpressaoInvalida,
    compilar_expressao,
    dividir_regra,
)
from src.dsl_parser.generator import generate_dsl

COLUNAS = ["Transaction ID", "Price per Item", "Quantity", "Total_Spent", "Price"]


class TestCompilacaoDeExpressao:
    def test_multiplicacao_simples(self):
        spark, refs = compilar_expressao("Price per Item * Quantity", COLUNAS)
        assert spark == "`Price per Item` * `Quantity`"
        assert refs == ["Price per Item", "Quantity"]

    def test_nome_com_espaco_vira_um_identificador_so(self):
        """Sem isto "Price per Item" viraria três identificadores soltos e o
        script quebraria no Colab."""
        spark, _ = compilar_expressao("Price per Item", COLUNAS)
        assert spark == "`Price per Item`"

    def test_casa_o_nome_mais_longo_primeiro(self):
        """'Price' é coluna e também prefixo de 'Price per Item'; casar o
        curto deixaria 'per Item' como lixo."""
        _, refs = compilar_expressao("Price per Item * 2", COLUNAS)
        assert refs == ["Price per Item"]

    def test_nome_curto_sozinho_ainda_resolve(self):
        _, refs = compilar_expressao("Price * Quantity", COLUNAS)
        assert refs == ["Price", "Quantity"]

    def test_nao_casa_prefixo_de_outra_palavra(self):
        with pytest.raises(ExpressaoInvalida):
            compilar_expressao("Prices * Quantity", COLUNAS)

    def test_parenteses_e_precedencia_sao_preservados(self):
        spark, _ = compilar_expressao("(Price per Item + 2) * Quantity", COLUNAS)
        assert spark == "( `Price per Item` + 2 ) * `Quantity`"

    def test_espacamento_irregular_no_nome_resolve(self):
        """Quem digita à mão raramente reproduz o espaçamento do cabeçalho."""
        spark, _ = compilar_expressao("price  per   item * Quantity", COLUNAS)
        assert spark == "`Price per Item` * `Quantity`"

    def test_decimais_sao_aceitos(self):
        spark, _ = compilar_expressao("Quantity * 1.5", COLUNAS)
        assert spark == "`Quantity` * 1.5"

    def test_crase_no_nome_da_coluna_e_escapada(self):
        spark, _ = compilar_expressao("a`b", ["a`b"])
        assert spark == "`a``b`"

    @pytest.mark.parametrize(
        "expressao",
        [
            "Quantity * Preco_Inexistente",
            "Quantity; DROP TABLE x",
            "__import__('os')",
            "Quantity * ",
            "",
            "   ",
        ],
    )
    def test_expressao_invalida_e_recusada(self, expressao):
        with pytest.raises(ExpressaoInvalida):
            compilar_expressao(expressao, COLUNAS)

    def test_parenteses_desbalanceados_sao_recusados(self):
        with pytest.raises(ExpressaoInvalida, match="arenthes"):
            compilar_expressao("(Quantity * 2", COLUNAS)
        with pytest.raises(ExpressaoInvalida, match="arenthes"):
            compilar_expressao("Quantity) * 2", COLUNAS)

    def test_expressao_so_com_constantes_e_recusada(self):
        """`total = 2 * 3` daria sempre a mesma resposta: não é regra."""
        with pytest.raises(ExpressaoInvalida, match="no column"):
            compilar_expressao("2 * 3", COLUNAS)

    def test_a_mensagem_de_erro_diz_qual_termo_falhou(self):
        with pytest.raises(ExpressaoInvalida, match="Preco_Inexistente"):
            compilar_expressao("Quantity * Preco_Inexistente", COLUNAS)


class TestDivisaoDaRegra:
    def test_separa_alvo_e_expressao(self):
        assert dividir_regra("Total = Price * Qty") == ("Total", "Price * Qty")

    def test_apenas_o_primeiro_igual_separa(self):
        alvo, expr = dividir_regra("a = b = c")
        assert alvo == "a" and expr == "b = c"

    @pytest.mark.parametrize("regra", ["Total Price * Qty", "= Price", "Total ="])
    def test_regra_malformada_e_recusada(self, regra):
        with pytest.raises(ExpressaoInvalida):
            dividir_regra(regra)


class TestIntegracaoComOChecklist:
    def _answers(self, regra):
        return {
            "What is the name of the dataset you want to validate?": "retail",
            "What is the source of the data?": "retail.csv",
            "What is the format of the data?": "CSV",
            "Does the data have a header?": "yes",
            "What are the expected column names, in order?": (
                "Transaction ID, Price per Item, Quantity, Total_Spent"
            ),
            "What is the expected data type for each column? Please list them in "
            "the same order as column names, separated by commas.": (
                "string, float, integer, float"
            ),
            "Are there any columns calculated from other columns?": regra,
        }

    def test_a_regra_do_relatorio_passa_a_ser_modelavel(self):
        dsl = generate_dsl(self._answers("Total_Spent = Price per Item * Quantity"))
        assert not dsl.get("errors"), dsl.get("errors")
        regras = [r for r in dsl["rules"] if r["type"] == "computed_comparison"]
        assert len(regras) == 1
        regra = regras[0]
        assert regra["column"] == "Total_Spent"
        assert regra["expression"] == "`Price per Item` * `Quantity`"
        assert regra["referenced_columns"] == ["Price per Item", "Quantity"]

    def test_varias_regras_separadas_por_ponto_e_virgula(self):
        dsl = generate_dsl(
            self._answers(
                "Total_Spent = Price per Item * Quantity; Quantity = Total_Spent / Price per Item"
            )
        )
        assert len([r for r in dsl["rules"] if r["type"] == "computed_comparison"]) == 2

    def test_coluna_alvo_inexistente_vira_erro_e_nao_codigo_quebrado(self):
        dsl = generate_dsl(self._answers("Inexistente = Quantity * 2"))
        mensagens = " ".join(e["message"] for e in dsl.get("errors", []))
        assert "Inexistente" in mensagens
        assert not [r for r in dsl["rules"] if r["type"] == "computed_comparison"]

    def test_tolerancia_acompanha_a_regra(self):
        """Ponto flutuante: 19.99 * 3 = 59.967000000000006. Igualdade exata
        reprovaria o dataset inteiro."""
        dsl = generate_dsl(self._answers("Total_Spent = Price per Item * Quantity"))
        assert dsl["rules"][-1]["tolerance"] > 0

    def test_uma_regra_ruim_nao_descarta_as_boas(self):
        dsl = generate_dsl(
            self._answers("Total_Spent = Price per Item * Quantity; X = Y * Z")
        )
        assert len([r for r in dsl["rules"] if r["type"] == "computed_comparison"]) == 1
        assert dsl.get("errors")
