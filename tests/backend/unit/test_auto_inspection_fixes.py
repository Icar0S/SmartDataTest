"""Fluxo automático (/pyspark/advanced): tipos detectados e regras geradas.

Do relatório de 2026-11-19:

  - *"não identifica o tipo data"* — nos dois fluxos;
  - *"colocar string em campos numéricos não quebra o código, mas ainda
    assim não é identificado como erro"*;
  - *"o código gerado sem validação do usuário resultou em um código que
    aceitou todos os casos de teste, mesmo aqueles que estavam
    propositalmente errados"*.

O último era o mais grave e o mais simples: as regras de faixa saíam do
MÍNIMO E MÁXIMO OBSERVADOS no próprio arquivo. Uma regra assim é tautológica
— por construção nenhuma linha do dataset pode violá-la.
"""

import pandas as pd
import pytest

from src.dataset_inspector.dsl_generator import generate_dsl_from_metadata
from src.dataset_inspector.inspector import (
    detectar_formato_de_data,
    detectar_numerica_suja,
    infer_column_statistics,
)


def coluna(valores):
    return pd.DataFrame({"c": valores})


def stats(valores):
    return infer_column_statistics(coluna(valores), "c")


class TestDeteccaoDeData:
    @pytest.mark.parametrize(
        "valores,formato",
        [
            (["2024-01-15", "2024-02-20", "2024-03-11"], "YYYY-MM-DD"),
            (["15/01/2024", "20/02/2024", "11/03/2024"], "DD/MM/YYYY"),
            (["2024/01/15", "2024/02/20"], "YYYY/MM/DD"),
            (["15-01-2024", "20-02-2024"], "DD-MM-YYYY"),
            (["2024-01-15 10:30:00", "2024-02-20 11:00:00"], "YYYY-MM-DD HH:mm:ss"),
        ],
    )
    def test_formatos_comuns_sao_reconhecidos(self, valores, formato):
        assert detectar_formato_de_data(pd.Series(valores)) == formato

    def test_coluna_de_data_deixa_de_ser_tratada_como_texto(self):
        """O defeito em uma linha: `pd.read_csv` devolve `object` e o
        mapeamento traduzia para `string`, sem nenhuma verificação."""
        assert stats(["2024-01-15", "2024-02-20", "2024-03-11"])["type"] == "date"

    def test_o_formato_detectado_acompanha_a_coluna(self):
        assert stats(["15/01/2024", "20/02/2024"])["date_format"] == "DD/MM/YYYY"

    def test_algumas_datas_invalidas_nao_descaracterizam_a_coluna(self):
        """Dataset sujo tem datas inválidas — é o que se quer relatar. Exigir
        perfeição devolveria a coluna para 'texto', onde nada é verificado."""
        valores = ["2024-01-15"] * 9 + ["not-a-date"]
        assert detectar_formato_de_data(pd.Series(valores)) == "YYYY-MM-DD"

    def test_texto_comum_nao_e_confundido_com_data(self):
        assert detectar_formato_de_data(pd.Series(["Cash", "Credit Card"])) is None

    def test_numero_puro_nao_e_confundido_com_data(self):
        assert detectar_formato_de_data(pd.Series(["12345678", "87654321"])) is None

    def test_coluna_vazia_nao_quebra(self):
        assert detectar_formato_de_data(pd.Series([], dtype=object)) is None
        assert detectar_formato_de_data(pd.Series([None, None])) is None


class TestColunaNumericaComSujeira:
    """Uma célula não numérica rebaixa a coluna inteira a texto, e o dado
    sujo deixa de ser verificado — que é exatamente o que se queria achar."""

    def test_coluna_majoritariamente_numerica_e_reconhecida(self):
        valores = ["10.5"] * 9 + ["N/A"]
        assert detectar_numerica_suja(pd.Series(valores)) == "float64"

    def test_inteiros_sao_distinguidos_de_decimais(self):
        assert detectar_numerica_suja(pd.Series(["1"] * 9 + ["x"])) == "int64"

    def test_texto_de_verdade_nao_e_tomado_por_numero(self):
        assert detectar_numerica_suja(pd.Series(["Cash", "Pix", "Boleto"])) is None

    def test_metade_numerica_nao_basta(self):
        """Abaixo do limiar a leitura honesta é 'coluna de texto'."""
        assert detectar_numerica_suja(pd.Series(["1", "2", "a", "b"])) is None

    def test_coluna_com_sujeira_ganha_regra_de_tipo(self):
        md = {
            "format": "csv",
            "detected_options": {"header": True},
            "columns": [stats(["10.5"] * 9 + ["abc"])],
        }
        md["columns"][0]["name"] = "Price"
        regras = generate_dsl_from_metadata(md)["rules"]
        tipos = [r for r in regras if r["type"] == "column_type"]
        assert tipos and tipos[0]["expected_type"] == "float"


class TestRegrasAutomaticasNaoSaoTautologicas:
    def _metadata(self):
        return {
            "format": "csv",
            "detected_options": {"header": True},
            "columns": [
                {
                    "name": "Quantity",
                    "type": "int64",
                    "null_ratio": 0.0,
                    "unique_ratio": 0.2,
                    "min": 1.0,
                    "max": 100.0,
                }
            ],
        }

    def test_faixa_nao_sai_mais_do_minimo_e_maximo_observados(self):
        """A regra que aceitava tudo: min/max vindos do próprio arquivo não
        podem ser violados por nenhuma linha dele."""
        regras = generate_dsl_from_metadata(self._metadata())["rules"]
        assert not [r for r in regras if r["type"] == "range"]

    def test_os_valores_observados_continuam_no_esquema(self):
        """Eles servem — para a pessoa escolher a faixa. Só não viram regra."""
        dsl = generate_dsl_from_metadata(self._metadata())
        assert dsl["schema"][0]["stats"]["min"] == 1.0
        assert dsl["schema"][0]["stats"]["max"] == 100.0

    def test_faixa_informada_pelo_usuario_e_respeitada(self):
        dsl = generate_dsl_from_metadata(
            self._metadata(),
            {"columns": {"Quantity": {"range": {"min": 1, "max": 10}}}},
        )
        faixas = [r for r in dsl["rules"] if r["type"] == "range"]
        assert faixas == [{"type": "range", "column": "Quantity", "min": 1, "max": 10}]

    def test_faixa_so_com_maximo_omite_o_minimo(self):
        dsl = generate_dsl_from_metadata(
            self._metadata(), {"columns": {"Quantity": {"range": {"max": 10}}}}
        )
        faixa = [r for r in dsl["rules"] if r["type"] == "range"][0]
        assert "min" not in faixa and faixa["max"] == 10

    def test_coluna_numerica_ganha_verificacao_de_tipo(self):
        """Sem a faixa tautológica, é a conformidade de tipo que passa a
        pegar dado sujo — sem exigir decisão nenhuma do usuário."""
        regras = generate_dsl_from_metadata(self._metadata())["rules"]
        tipos = [r for r in regras if r["type"] == "column_type"]
        assert tipos and tipos[0]["expected_type"] == "integer"

    def test_coluna_de_data_ganha_tipo_e_formato(self):
        md = {
            "format": "csv",
            "detected_options": {"header": True},
            "columns": [
                {
                    "name": "Transaction Date",
                    "type": "date",
                    "date_format": "YYYY-MM-DD",
                    "null_ratio": 0.0,
                    "unique_ratio": 0.5,
                }
            ],
        }
        regras = generate_dsl_from_metadata(md)["rules"]
        assert {"type": "column_type", "column": "Transaction Date", "expected_type": "date"} in regras
        assert {"type": "format", "column": "Transaction Date", "format": "YYYY-MM-DD"} in regras

    def test_coluna_de_texto_nao_ganha_regra_de_tipo(self):
        """Todo valor é uma string válida; a regra nunca falharia."""
        md = {
            "format": "csv",
            "detected_options": {"header": True},
            "columns": [
                {"name": "Payment", "type": "object", "null_ratio": 0.0, "unique_ratio": 0.1}
            ],
        }
        regras = generate_dsl_from_metadata(md)["rules"]
        assert not [r for r in regras if r["type"] == "column_type"]
