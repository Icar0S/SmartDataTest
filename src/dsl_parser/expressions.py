"""Compilador de expressões aritméticas entre colunas.

POR QUE EXISTE

O checklist só sabia comparar uma coluna com outra (`preco > custo`). Não
havia como dizer que uma coluna é CALCULADA a partir de outras, e o relatório
de testes de 2026-11-19 registrou exatamente isso no dataset Retail Store
Sales: *"Não foi possível modelar a regra de negócio
Total_Spent = Price per Item * Quantity"*.

Regras assim são o coração de qualidade de dados em vendas e finanças —
total = preço × quantidade, margem = receita − custo, saldo = entradas −
saídas — e eram justamente as que a ferramenta não alcançava.

POR QUE UM COMPILADOR, E NÃO INTERPOLAÇÃO DIRETA

O texto do usuário vira código PySpark que ele roda no Colab. Interpolar a
expressão crua geraria código quebrado ao primeiro nome de coluna com espaço
("Price per Item" vira três identificadores soltos) e aceitaria qualquer
texto, produzindo um script que só falha na cara de quem executa.

Aqui os nomes de coluna são resolvidos contra o esquema declarado — casando
o mais longo primeiro, que é o que faz "Price per Item" vencer "Price" — e
qualquer token que não seja coluna conhecida, número ou operador é recusado
com mensagem. O resultado é uma expressão Spark SQL com identificadores em
crase, ou um erro ANTES de gerar código.
"""

from __future__ import annotations

import re
from typing import List, Optional, Sequence, Tuple

OPERADORES = set("+-*/()")

_NUMERO = re.compile(r"\d+(?:\.\d+)?")
_ESPACO = re.compile(r"\s+")


class ExpressaoInvalida(ValueError):
    """Expressão que não pôde ser compilada; a mensagem explica o porquê."""


def _escapar_identificador(nome: str) -> str:
    """Envolve em crase para o Spark SQL, escapando crases internas."""
    return "`" + nome.replace("`", "``") + "`"


def compilar_expressao(
    expressao: str, colunas_conhecidas: Sequence[str]
) -> Tuple[str, List[str]]:
    """Traduz uma expressão aritmética para Spark SQL.

    Devolve (expressao_spark, colunas_referenciadas).

    Levanta ExpressaoInvalida quando encontra algo que não seja coluna
    conhecida, número ou um dos operadores `+ - * / ( )`.
    """
    if not expressao or not expressao.strip():
        raise ExpressaoInvalida("Expression is empty.")

    # Mais longo primeiro: sem isso, "Price" casaria dentro de
    # "Price per Item" e sobrariam "per Item" como lixo.
    candidatos = sorted({c for c in colunas_conhecidas if c}, key=len, reverse=True)
    padroes = [(c, _padrao_da_coluna(c)) for c in candidatos]

    texto = expressao.strip()
    saida: List[str] = []
    referenciadas: List[str] = []
    i = 0
    profundidade = 0

    while i < len(texto):
        char = texto[i]

        if char.isspace():
            i += 1
            continue

        if char in OPERADORES:
            if char == "(":
                profundidade += 1
            elif char == ")":
                profundidade -= 1
                if profundidade < 0:
                    raise ExpressaoInvalida(
                        f"Unbalanced parentheses in '{expressao}'."
                    )
            saida.append(char)
            i += 1
            continue

        numero = _NUMERO.match(texto, i)
        if numero:
            saida.append(numero.group())
            i = numero.end()
            continue

        casou = _casar_coluna(texto, i, padroes)
        if casou is not None:
            coluna, consumidos = casou
            saida.append(_escapar_identificador(coluna))
            if coluna not in referenciadas:
                referenciadas.append(coluna)
            i += consumidos
            continue

        # Nada casou: aponta exatamente onde parou, porque "expressão
        # inválida" sem posição obriga o usuário a adivinhar.
        resto = texto[i:].strip()
        token = resto.split()[0] if resto.split() else resto
        raise ExpressaoInvalida(
            f"Unknown term '{token}' in expression '{expressao}'. "
            f"Use only column names declared in the schema, numbers and the "
            f"operators + - * / ( )."
        )

    if profundidade != 0:
        raise ExpressaoInvalida(f"Unbalanced parentheses in '{expressao}'.")

    if not referenciadas:
        raise ExpressaoInvalida(
            f"Expression '{expressao}' references no column; a rule comparing "
            f"only constants would always give the same answer."
        )

    # Forma, não só vocabulário: "Quantity * " tem todos os termos válidos e
    # mesmo assim não é uma expressão.
    _validar_gramatica(saida, expressao)

    return " ".join(saida), referenciadas


def _padrao_da_coluna(coluna: str) -> "re.Pattern[str]":
    """Regex que casa o nome da coluna com espaçamento livre.

    "price  per   item" precisa encontrar "Price per Item": quem digita o
    nome à mão raramente reproduz o espaçamento exato do cabeçalho. O
    casamento devolve quantos caracteres do texto ORIGINAL foram consumidos
    — comparar com `len(nome_canônico)` avançaria o cursor a menos e deixaria
    um resto ("tem") para trás.
    """
    partes = [re.escape(p) for p in coluna.split()]
    corpo = r"\s+".join(partes) if partes else re.escape(coluna)
    # (?![\w]) impede casamento parcial: "Price" não pode casar em "Prices".
    return re.compile(corpo + r"(?!\w)", re.IGNORECASE)


def _casar_coluna(
    texto: str, posicao: int, padroes: Sequence[Tuple[str, "re.Pattern[str]"]]
) -> Optional[Tuple[str, int]]:
    """(nome canônico, caracteres consumidos) da coluna em `posicao`, ou None."""
    for coluna, padrao in padroes:
        m = padrao.match(texto, posicao)
        if m:
            return coluna, m.end() - posicao
    return None


def _validar_gramatica(tokens: List[str], expressao: str) -> None:
    """Confere a forma da expressão usando o próprio parser do Python.

    Os tokens já foram restringidos a colunas, números e `+ - * / ( )`, mas
    isso não garante que estejam numa ordem válida: "Quantity * " passa pela
    filtragem e produz código quebrado no Colab. A gramática aritmética do
    Python é exatamente a que queremos, então as colunas viram nomes
    sintéticos e o resultado é apenas ANALISADO — nunca executado.
    """
    neutro = []
    contador = 0
    for token in tokens:
        if token.startswith("`"):
            neutro.append(f"_c{contador}")
            contador += 1
        else:
            neutro.append(token)
    try:
        import ast

        ast.parse(" ".join(neutro), mode="eval")
    except SyntaxError as exc:
        raise ExpressaoInvalida(
            f"Expression '{expressao}' is not a valid arithmetic expression "
            f"({exc.msg})."
        ) from exc


def dividir_regra(regra: str) -> Tuple[str, str]:
    """Separa 'coluna = expressão' em (coluna, expressão).

    O `=` é o separador, e só o primeiro conta: `a = b - c` tem um só.
    """
    if "=" not in regra:
        raise ExpressaoInvalida(
            f"Business rule '{regra}' has no '='. Write it as "
            f"'column = expression' (e.g., 'Total = Price * Quantity')."
        )
    alvo, _, expressao = regra.partition("=")
    alvo = alvo.strip()
    if not alvo:
        raise ExpressaoInvalida(f"Business rule '{regra}' has no target column.")
    if not expressao.strip():
        raise ExpressaoInvalida(
            f"Business rule '{regra}' has no expression after '='."
        )
    return alvo, expressao.strip()
