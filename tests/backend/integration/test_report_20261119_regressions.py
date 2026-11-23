"""Relatório de testes de 2026-11-19, item a item, ponta a ponta.

Cada teste aqui reproduz um defeito relatado pelo time de testes nos três
datasets (Retail Store Sales, Dirty Financial Transactions, Car Features and
Prices) e afirma o comportamento corrigido, atravessando o caminho real:
respostas do checklist → DSL → código PySpark, e arquivo → inspeção → DSL →
código.

O que se verifica é o CÓDIGO GERADO. Executá-lo exigiria um cluster Spark,
que este repositório deliberadamente não traz como dependência (ver a nota
no topo de requirements.txt). Onde a correção depende de semântica do Spark,
o teste fixa a forma da expressão que a produz.
"""

import ast

import pytest

from src.code_generator.pyspark_generator import generate_pyspark_code
from src.dataset_inspector.dsl_generator import generate_dsl_from_metadata
from src.dataset_inspector.inspector import inspect_dataset
from src.dsl_parser.generator import generate_dsl

# ── Retail Store Sales, como descrito no relatório ────────────────────────
RETAIL = (
    "Transaction ID,Price per Item,Quantity,Total_Spent,Transaction Date,Payment Method\n"
    "TXN_1234567,10.50,3,31.50,2024-01-15,Cash\n"
    "TXN_1234568,20.00,2,40.00,2024-02-20,Credit Card\n"
    "TXN_1234569,5.25,4,21.00,2024-03-11,Digital Wallet\n"
    "TXN_1234570,abc,2,30.00,2024-04-01,Cash\n"
    "TXN_1234571,15.00,2,99.99,2024-05-30,Pix\n"
    "BAD_ID,7.00,1,7.00,not-a-date,Cash\n"
)


@pytest.fixture
def retail_csv(tmp_path):
    caminho = tmp_path / "retail.csv"
    caminho.write_text(RETAIL, encoding="utf-8")
    return str(caminho)


RESPOSTAS_RETAIL = {
    "What is the name of the dataset you want to validate? (e.g., customer_data)": "retail",
    "What is the source of the data (e.g., a file path like /data/customer.csv, "
    "or a database table name like sales.customers)?": "retail.csv",
    "What is the format of the data (e.g., CSV, JSON, Parquet, Delta)?": "CSV",
    "Does the data have a header? (yes/no)": "yes",
    "What are the expected column names, in order? (e.g., id, first_name, last_name, email)":
        "Transaction ID, Price per Item, Quantity, Total_Spent, Transaction Date, Payment Method",
    "What is the expected data type for each column (e.g., integer, string, float, date)? "
    "Please list them in the same order as column names, separated by commas. "
    "(e.g., integer, string, string, string)":
        "string, float, integer, float, date, string",
    "Are there any columns that should have a minimum or maximum value? "
    "List as 'column:min:max', 'column::max', or 'column:min:', separated by commas. "
    "(e.g., age:18:99, price::1000, quantity:1:)": "Quantity:1:100",
    "Are there any columns that should only contain values from a specific set "
    "(e.g., a list of categories)? List as 'column:[value1,value2]', separated by '],'. "
    "(e.g., status:[active,inactive,pending], gender:[M,F,Other])":
        "Payment Method:[Cash,Credit Card,Digital Wallet]",
    "Are there any columns that should match a specific regular expression pattern? "
    "List as 'column:pattern', separated by commas.": "Transaction ID:TXN_[0-9]{7}",
    "Are there any columns calculated from other columns? List as 'column=expression', "
    "separated by ';'.": "Total_Spent = Price per Item * Quantity",
}


@pytest.fixture
def dsl_manual():
    return generate_dsl(RESPOSTAS_RETAIL)


@pytest.fixture
def codigo_manual(dsl_manual):
    return generate_pyspark_code(dsl_manual)


class TestGeracaoManual:
    """Fluxo /qa-checklist, dataset Retail Store Sales."""

    def test_as_respostas_nao_sao_mais_descartadas(self, dsl_manual):
        """7 das 14 respostas eram perdidas por divergência de redação."""
        assert not dsl_manual.get("errors"), dsl_manual.get("errors")
        assert dsl_manual["dataset"]["name"] == "retail"
        assert dsl_manual["dataset"]["format"] == "CSV"

    def test_o_tipo_data_declarado_vira_verificacao(self, dsl_manual):
        """*"nenhuma data é identificada como o tipo correto, apesar de
        possuir o tipo exato de dado"*."""
        tipos = {
            r["column"]: r["expected_type"]
            for r in dsl_manual["rules"]
            if r["type"] == "column_type"
        }
        assert tipos["Transaction Date"] == "date"

    def test_a_regra_de_negocio_passa_a_ser_modelavel(self, dsl_manual):
        """*"não foi possível modelar Total_Spent = Price per Item *
        Quantity"*."""
        regras = [r for r in dsl_manual["rules"] if r["type"] == "computed_comparison"]
        assert len(regras) == 1
        assert regras[0]["expression"] == "`Price per Item` * `Quantity`"

    def test_a_expressao_regular_vira_regra(self, dsl_manual):
        """*"as expressões regulares não estão sendo validadas"*."""
        assert [r for r in dsl_manual["rules"] if r["type"] == "regex"]

    def test_os_valores_categoricos_viram_regra(self, dsl_manual):
        """*"mesmo definindo valores categóricos [...] não há verificação"*."""
        conjuntos = [r for r in dsl_manual["rules"] if r["type"] == "in_set"]
        assert conjuntos and conjuntos[0]["column"] == "Payment Method"

    def test_texto_em_coluna_numerica_passa_a_ser_verificado(self, dsl_manual):
        """*"colocar strings em colunas que deveriam conter números quebra o
        código"*. Price per Item é float declarado; a linha com "abc" é o
        alvo."""
        tipos = {
            r["column"]: r["expected_type"]
            for r in dsl_manual["rules"]
            if r["type"] == "column_type"
        }
        assert tipos["Price per Item"] == "float"
        assert tipos["Quantity"] == "integer"

    def test_o_codigo_gerado_e_python_valido(self, codigo_manual):
        """*"necessitando a correção manual do código"* — Car Features."""
        ast.parse(codigo_manual)

    def test_o_filtro_de_faixa_tem_os_parenteses(self, codigo_manual):
        """*"usa do operador | sem parênteses"* — os três datasets."""
        assert "(valores < 1.0) | (valores > 100.0)" in codigo_manual


class TestGeracaoAutomatica:
    """Fluxo /pyspark/advanced, a partir do arquivo."""

    def test_a_coluna_de_data_e_reconhecida(self, retail_csv):
        """*"não identifica o tipo data"*."""
        md = inspect_dataset(retail_csv, "csv")
        por_nome = {c["name"]: c for c in md["columns"]}
        assert por_nome["Transaction Date"]["type"] == "date"
        assert por_nome["Transaction Date"]["date_format"] == "YYYY-MM-DD"

    def test_a_coluna_numerica_suja_e_reconhecida(self, retail_csv):
        """Price per Item tem "abc" numa linha: o pandas rebaixaria a coluna
        a texto e o dado sujo deixaria de ser verificado."""
        md = inspect_dataset(retail_csv, "csv")
        por_nome = {c["name"]: c for c in md["columns"]}
        assert por_nome["Price per Item"]["type"] == "float64"

    def test_nao_gera_regra_que_nunca_falha(self, retail_csv):
        """*"aceitou todos os casos de teste, mesmo aqueles que estavam
        propositalmente errados"* — a faixa saía do min/max do arquivo."""
        dsl = generate_dsl_from_metadata(inspect_dataset(retail_csv, "csv"))
        assert not [r for r in dsl["rules"] if r["type"] == "range"]

    def test_gera_verificacoes_que_podem_falhar(self, retail_csv):
        """O contraponto do teste acima: sem a faixa tautológica, tem de
        sobrar verificação de verdade — senão a correção só emudeceu a
        ferramenta."""
        dsl = generate_dsl_from_metadata(inspect_dataset(retail_csv, "csv"))
        tipos = {r["type"] for r in dsl["rules"]}
        assert "column_type" in tipos
        assert "format" in tipos

    def test_o_codigo_automatico_e_python_valido(self, retail_csv):
        dsl = generate_dsl_from_metadata(inspect_dataset(retail_csv, "csv"))
        ast.parse(generate_pyspark_code(dsl))


class TestDirtyFinancialTransactions:
    """Segundo dataset do relatório: faixa em Quantity e categóricos."""

    def test_faixa_e_categoricos_no_mesmo_script(self):
        dsl = generate_dsl(
            {
                "What is the name of the dataset you want to validate?": "dirty",
                "What is the source of the data?": "dirty.csv",
                "What is the format of the data?": "CSV",
                "Does the data have a header?": "yes",
                "What are the expected column names, in order?":
                    "transaction_id, customer_id, quantity, price, payment_method, status",
                "What is the expected data type for each column? Please list them in "
                "the same order as column names, separated by commas.":
                    "string, string, integer, float, string, string",
                "Are there any columns that should have a minimum or maximum value? "
                "List as 'column:min:max'.": "quantity:1:1000",
                "Are there any columns that should only contain values from a "
                "specific set (e.g., a list of categories)?":
                    "status:[completed,pending,failed]",
            }
        )
        assert not dsl.get("errors"), dsl.get("errors")
        tipos = {r["type"] for r in dsl["rules"]}
        assert {"range", "in_set", "column_type"} <= tipos

        codigo = generate_pyspark_code(dsl)
        ast.parse(codigo)
        assert "(valores < 1.0) | (valores > 1000.0)" in codigo
        assert "valores_aceitos = ['completed', 'pending', 'failed']" in codigo
