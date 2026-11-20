"""Defeitos do código PySpark gerado, do relatório de testes de 2026-11-19.

O relatório cobriu três datasets (Retail Store Sales, Dirty Financial
Transactions, Car Features and Prices) nos fluxos manual (/qa-checklist) e
automático (/pyspark/advanced). Cada classe aqui corresponde a um item dele.

O que estes testes verificam é o CÓDIGO GERADO, não a execução no Spark:
a geração é o que este repositório controla. Onde a correção depende de
semântica do Spark (conversão, nulos), o teste fixa a FORMA da expressão que
produz essa semântica, que é o que uma regressão quebraria.
"""

import ast

import pytest

from src.code_generator.pyspark_generator import _anchor_regex, generate_pyspark_code

DATASET = {"dataset": {"name": "t", "format": "csv", "has_header": True}}


def gerar(*regras):
    return generate_pyspark_code({**DATASET, "rules": list(regras)})


def corpo_da_checagem(codigo, marcador):
    """Trecho do código gerado a partir do marcador, para inspeção pontual."""
    i = codigo.index(marcador)
    return codigo[i : i + 700]


class TestCodigoGeradoCompila:
    """Nada abaixo importa se o script não for Python válido."""

    def test_script_com_todas_as_regras_compila(self):
        codigo = gerar(
            {"type": "not_null", "column": "a"},
            {"type": "uniqueness", "columns": ["a", "b"]},
            {"type": "range", "column": "Quantity", "min": 1, "max": 100},
            {"type": "in_set", "column": "Payment Method", "values": ["Cash", "Pix"]},
            {"type": "regex", "column": "id", "pattern": r"TXN_\d{7}"},
            {"type": "format", "column": "d", "format": "YYYY-MM-DD"},
            {"type": "column_type", "column": "Quantity", "expected_type": "integer"},
            {"type": "cross_column_comparison", "column1": "a", "operator": "<", "column2": "b"},
            {
                "type": "computed_comparison",
                "column": "Total",
                "operator": "==",
                "expression": "`Price per Item` * `Quantity`",
                "referenced_columns": ["Price per Item", "Quantity"],
                "tolerance": 0.01,
            },
        )
        ast.parse(codigo)  # SyntaxError reprova o teste

    def test_valor_com_aspa_simples_nao_quebra_o_script(self):
        """"O'Brien" fechava a aspa do literal e gerava código inválido."""
        codigo = gerar({"type": "in_set", "column": "nome", "values": ["O'Brien", "Smith"]})
        ast.parse(codigo)


class TestPrecedenciaDoOperadorOu:
    """*"o código [...] usa do operador | sem parênteses"* — os 3 datasets.

    Em Python `|` tem precedência MAIOR que `<` e `>`. Sem parênteses,
    `col("q") < 1.0 | col("q") > 100.0` é lido como
    `col("q") < (1.0 | col("q")) > 100.0`: o `|` é avaliado primeiro, entre
    um número e uma coluna. O script precisava de correção manual antes de
    rodar, e nos Car Features isso o tornou inviável.
    """

    def test_a_precedencia_do_python_realmente_inverte_a_expressao(self):
        """Prova a premissa, sem depender do nosso gerador nem do Spark."""
        sem_parenteses = ast.parse("x < 1.0 | x > 100.0", mode="eval").body
        # Vira uma comparação encadeada cujo operando do meio é o `|`.
        assert isinstance(sem_parenteses, ast.Compare)
        meio = sem_parenteses.comparators[0]
        assert isinstance(meio, ast.BinOp) and isinstance(meio.op, ast.BitOr), (
            "sem parênteses o | é avaliado ANTES das comparações"
        )

        com_parenteses = ast.parse("(x < 1.0) | (x > 100.0)", mode="eval").body
        assert isinstance(com_parenteses, ast.BinOp)
        assert isinstance(com_parenteses.left, ast.Compare)
        assert isinstance(com_parenteses.right, ast.Compare)

    def test_faixa_com_minimo_e_maximo_parentetiza_cada_lado(self):
        codigo = gerar({"type": "range", "column": "Quantity", "min": 1, "max": 100})
        trecho = corpo_da_checagem(codigo, "Checking range")
        assert "(valores < 1.0)" in trecho
        assert "(valores > 100.0)" in trecho
        # A forma antiga, sem parênteses, não pode reaparecer.
        assert "valores < 1.0 | valores" not in trecho

    def test_a_expressao_da_faixa_tem_a_arvore_correta(self):
        """Verifica a árvore sintática, não o texto: parênteses em lugar
        errado passariam numa comparação de strings."""
        codigo = gerar({"type": "range", "column": "q", "min": 1, "max": 100})
        arvore = ast.parse(codigo)
        achou = False
        for no in ast.walk(arvore):
            if isinstance(no, ast.BinOp) and isinstance(no.op, ast.BitOr):
                # Todo operando de um | tem de ser uma expressão completa,
                # nunca um número solto como na forma quebrada.
                for lado in (no.left, no.right):
                    assert not isinstance(lado, ast.Constant), (
                        "um operando constante de | é a assinatura do bug de precedência"
                    )
                achou = True
        assert achou, "a regra de faixa deveria produzir um |"

    def test_somente_minimo_nao_produz_operador_ou(self):
        codigo = gerar({"type": "range", "column": "q", "min": 0})
        trecho = corpo_da_checagem(codigo, "Checking range")
        assert "(valores < 0.0)" in trecho
        assert "valores >" not in trecho


class TestTextoEmColunaNumerica:
    """*"colocar strings em colunas que deveriam conter números quebra o
    código"* e *"não é identificado como erro"*.

    O Spark lê a coluna inteira como texto quando uma linha não é número.
    Comparar com um número converte em silêncio, e a linha com "abc" vira
    NULL — que nenhuma comparação casa, então ela some de todas as
    verificações em vez de reprovar.
    """

    def test_faixa_converte_a_coluna_e_trata_nao_numerico_como_falha(self):
        codigo = gerar({"type": "range", "column": "Quantity", "min": 1, "max": 100})
        trecho = corpo_da_checagem(codigo, "Checking range")
        assert 'valores = as_number("Quantity")' in trecho
        assert "valores.isNull()" in trecho, (
            "o valor não numérico precisa contar como falha, não como ausência"
        )
        assert 'col("Quantity").isNotNull()' in trecho, (
            "nulo é assunto da regra de obrigatoriedade, não desta"
        )

    def test_helper_de_conversao_existe_no_script(self):
        codigo = gerar({"type": "range", "column": "q", "min": 1})
        assert "def as_number(" in codigo
        assert 'cast("double")' in codigo

    @pytest.mark.parametrize(
        "tipo,trecho_esperado",
        [
            ("integer", 'col("c").cast("long")'),
            ("float", 'as_number("c")'),
            ("date", 'as_date("c")'),
            ("timestamp", 'as_timestamp("c")'),
            ("boolean", 'col("c").cast("boolean")'),
        ],
    )
    def test_regra_de_tipo_gera_a_conversao_certa(self, tipo, trecho_esperado):
        codigo = gerar({"type": "column_type", "column": "c", "expected_type": tipo})
        assert trecho_esperado in codigo
        assert 'col("c").isNotNull()' in codigo

    def test_tipo_desconhecido_nao_gera_checagem(self):
        codigo = gerar({"type": "column_type", "column": "c", "expected_type": "string"})
        assert "type_c" not in codigo


class TestRegex:
    """*"as expressões regulares não estão sendo validadas"* — 2 datasets.

    A causa principal era a resposta ser descartada (ver
    test_question_resolution.py). Resolvido isso, sobrava a semântica:
    `rlike` BUSCA o padrão, não casa a string inteira.
    """

    def test_padrao_sem_ancora_passa_a_casar_o_campo_inteiro(self):
        assert _anchor_regex(r"\d{3}") == r"^(?:\d{3})$"

    def test_ancoras_existentes_nao_sao_duplicadas(self):
        assert _anchor_regex(r"^TXN_\d{7}$") == r"^(?:TXN_\d{7})$"

    def test_cifrao_escapado_nao_e_confundido_com_ancora(self):
        """`\\$` é um cifrão literal — remover seria mudar o padrão."""
        assert _anchor_regex(r"R\$\d+") == r"^(?:R\$\d+)$"

    def test_padrao_na_mensagem_nao_vira_escape_nem_campo_de_formatacao(self):
        """O padrão também aparece na mensagem, que é uma f-string.

        Cru, `\\d` é escape inválido (SyntaxWarning a cada execução) e
        `{7}` é interpretado como campo de formatação, imprimindo "7" no
        lugar do quantificador.
        """
        codigo = gerar({"type": "regex", "column": "id", "pattern": r"TXN_\d{7}"})
        linha = next(l for l in codigo.split("\n") if "Checking regex pattern" in l)
        assert r"\\d" in linha, "a barra precisa estar escapada na mensagem"
        assert "{{7}}" in linha, "as chaves precisam estar duplicadas na mensagem"

    def test_regra_de_regex_ignora_nulos(self):
        codigo = gerar({"type": "regex", "column": "id", "pattern": r"TXN_\d+"})
        trecho = corpo_da_checagem(codigo, "Checking regex")
        assert 'col("id").isNotNull()' in trecho


class TestValoresCategoricos:
    """*"mesmo definindo valores categóricos [...] não há verificação alguma"*."""

    def test_in_set_ignora_nulos(self):
        codigo = gerar({"type": "in_set", "column": "st", "values": ["A", "B"]})
        trecho = corpo_da_checagem(codigo, "Checking values in set")
        assert 'col("st").isNotNull()' in trecho
        assert '~col("st").isin' in trecho

    def test_conjunto_vazio_nao_gera_regra(self):
        """Sem valores a regra reprovaria tudo, inclusive o dado correto."""
        assert "in_set_st" not in gerar({"type": "in_set", "column": "st", "values": []})


class TestRegraDeNegocioCalculada:
    """*"não foi possível modelar a regra Total_Spent = Price per Item *
    Quantity"* — Retail Store Sales."""

    def _codigo(self):
        return gerar(
            {
                "type": "computed_comparison",
                "column": "Total_Spent",
                "operator": "==",
                "expression": "`Price per Item` * `Quantity`",
                "expression_source": "Price per Item * Quantity",
                "referenced_columns": ["Price per Item", "Quantity"],
                "tolerance": 0.01,
            }
        )

    def test_gera_a_expressao_com_identificadores_em_crase(self):
        assert 'expr("`Price per Item` * `Quantity`")' in self._codigo()

    def test_compara_com_tolerancia_e_nao_por_igualdade_exata(self):
        codigo = self._codigo()
        assert "spark_abs(valor_declarado - valor_calculado) > 0.01" in codigo
        assert "valor_declarado == valor_calculado" not in codigo

    def test_confere_a_existencia_de_todas_as_colunas_citadas(self):
        codigo = self._codigo()
        for coluna in ("Total_Spent", "Price per Item", "Quantity"):
            assert f'check_column_exists(df, "{coluna}")' in codigo

    def test_linha_nao_avaliavel_e_relatada_a_parte(self):
        """Valor não numérico impede a conta; somá-lo às violações da regra
        esconderia um problema de tipo atrás de um de regra de negócio."""
        assert "business_rule_Total_Spent_not_numeric" in self._codigo()


class TestComparacaoEntreColunas:
    def test_compara_somente_onde_os_dois_lados_existem(self):
        codigo = gerar(
            {"type": "cross_column_comparison", "column1": "a", "operator": "<", "column2": "b"}
        )
        trecho = corpo_da_checagem(codigo, "Checking cross-column")
        assert 'col("a").isNotNull()' in trecho
        assert 'col("b").isNotNull()' in trecho
