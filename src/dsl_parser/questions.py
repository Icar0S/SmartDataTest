"""Registro canônico das perguntas do checklist e resolução das respostas.

POR QUE ESTE MÓDULO EXISTE

O `/ask` recebe as respostas num dicionário cujas CHAVES SÃO O TEXTO DA
PERGUNTA, e o gerador de DSL as lia com `answers.get("texto exato...")`. O
texto estava duplicado em quatro lugares — `frontend/src/pages/QaChecklist.js`,
`src/chatbot/questions.py`, as chamadas `answers.get()` em `generator.py` e
`utilities/sample_answers.py` — e os quatro divergiram.

Medido em 2026-11-19: **7 das 14 respostas eram descartadas em silêncio**.
Bastava um exemplo a mais entre parênteses para a resposta nunca chegar ao
gerador. Foi isso que produziu três itens do relatório de testes:

  - "as expressões regulares não estão sendo validadas" — a resposta de regex
    era jogada fora;
  - "mesmo definindo valores categóricos [...] não há verificação alguma" — a
    resposta de conjunto de valores era jogada fora;
  - "nenhuma data é identificada como o tipo correto, apesar de possuir o tipo
    exato de dado" — a resposta com os tipos declarados era jogada fora.

Nenhum dos três era um defeito da regra em si: as regras funcionavam, mas
nunca eram criadas.

COMO ISTO RESOLVE

Cada pergunta ganha uma CHAVE ESTÁVEL (`dataset_name`, `regex_patterns`, ...)
e as respostas são resolvidas por comparação NORMALIZADA: exemplos entre
parênteses e instruções de formatação ("List as ...") são descartados antes
de comparar. Mudar o texto de uma pergunta deixa de quebrar a regra, que é o
que torna o defeito impossível de reaparecer.

A resolução aceita, em ordem:

  1. a chave estável, se o cliente já mandar `{"dataset_name": "..."}`;
  2. o texto exato de qualquer variante conhecida;
  3. o texto normalizado — é o que recupera as variações de redação.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple

# ── chaves estáveis ────────────────────────────────────────────────────────
# Mudar um valor destes é mudança de contrato; mudar o `text` ao lado não é.
DATASET_NAME = "dataset_name"
DATASET_SOURCE = "dataset_source"
DATASET_FORMAT = "dataset_format"
HAS_HEADER = "has_header"
COLUMN_NAMES = "column_names"
COLUMN_TYPES = "column_types"
MANDATORY_COLUMNS = "mandatory_columns"
UNIQUE_COLUMNS = "unique_columns"
COLUMN_FORMATS = "column_formats"
VALUE_RANGES = "value_ranges"
VALUE_SETS = "value_sets"
REGEX_PATTERNS = "regex_patterns"
VALUE_DISTRIBUTION = "value_distribution"
CROSS_COLUMN = "cross_column"
BUSINESS_RULES = "business_rules"


@dataclass(frozen=True)
class Question:
    key: str
    section: str
    text: str
    aliases: Tuple[str, ...] = field(default_factory=tuple)


QUESTIONS: Tuple[Question, ...] = (
    Question(
        DATASET_NAME,
        "General",
        "What is the name of the dataset you want to validate? (e.g., customer_data)",
    ),
    Question(
        DATASET_SOURCE,
        "General",
        "What is the source of the data (e.g., a file path like /data/customer.csv, "
        "or a database table name like sales.customers)?",
    ),
    Question(
        DATASET_FORMAT,
        "General",
        "What is the format of the data (e.g., CSV, JSON, Parquet, Delta)?",
    ),
    Question(
        HAS_HEADER,
        "Schema Validation",
        "Does the data have a header? (yes/no)",
    ),
    Question(
        COLUMN_NAMES,
        "Schema Validation",
        "What are the expected column names, in order? "
        "(e.g., id, first_name, last_name, email)",
    ),
    Question(
        COLUMN_TYPES,
        "Schema Validation",
        "What is the expected data type for each column "
        "(e.g., integer, string, float, date)? Please list them in the same order "
        "as column names, separated by commas. (e.g., integer, string, string, string)",
    ),
    Question(
        MANDATORY_COLUMNS,
        "Data Integrity",
        "Which columns should not contain any missing values (i.e., are mandatory)? "
        "List them separated by commas. (e.g., id, email)",
    ),
    Question(
        UNIQUE_COLUMNS,
        "Data Integrity",
        "Which columns should contain unique values (i.e., are primary keys)? "
        "List them separated by commas. (e.g., id, order_id)",
    ),
    Question(
        COLUMN_FORMATS,
        "Data Integrity",
        "Are there any columns that should have a specific format "
        "(e.g., a date format like YYYY-MM-DD)? List as 'column:format', "
        "separated by commas. "
        "(e.g., registration_date:YYYY-MM-DD, transaction_time:HH:mm:ss)",
    ),
    Question(
        VALUE_RANGES,
        "Value Constraints",
        "Are there any columns that should have a minimum or maximum value? "
        "List as 'column:min:max', 'column::max', or 'column:min:', "
        "separated by commas. (e.g., age:18:99, price::1000, quantity:1:)",
    ),
    Question(
        VALUE_SETS,
        "Value Constraints",
        "Are there any columns that should only contain values from a specific set "
        "(e.g., a list of categories)? List as 'column:[value1,value2]', "
        "separated by '],'. "
        "(e.g., status:[active,inactive,pending], gender:[M,F,Other])",
    ),
    Question(
        REGEX_PATTERNS,
        "Value Constraints",
        r"Are there any columns that should match a specific regular expression pattern? "
        r"List as 'column:pattern', separated by commas. "
        r"(e.g., email:^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$, "
        r"phone_number:^\d{3}-\d{3}-\d{4}$)",
    ),
    Question(
        VALUE_DISTRIBUTION,
        "Value Constraints",
        "Are there any columns for which you want to check the value distribution "
        "(e.g., to ensure certain values appear with a specific frequency)? "
        "List as 'column:value:min_freq:max_freq', separated by commas. "
        "(e.g., status:active:0.7:1.0, status:inactive:0.0:0.1)",
    ),
    Question(
        CROSS_COLUMN,
        "Cross-Column Validation",
        "Are there any relationships between two columns that should always hold true "
        "(e.g., 'start_date' must be before 'end_date', 'price' must be greater than "
        "'cost')? List as 'column1:operator:column2', separated by commas. "
        "Supported operators: <, <=, >, >=, ==, !=. "
        "(e.g., start_date:<:end_date, price:>:cost)",
    ),
    Question(
        BUSINESS_RULES,
        "Cross-Column Validation",
        "Are there any columns calculated from other columns? "
        "List as 'column=expression', separated by ';'. "
        "Supported operators: + - * / and parentheses. "
        "(e.g., Total_Spent = Price per Item * Quantity; Margin = Revenue - Cost)",
    ),
)

QUESTIONS_BY_SECTION: Dict[str, List[str]] = {}
for _q in QUESTIONS:
    QUESTIONS_BY_SECTION.setdefault(_q.section, []).append(_q.text)


# ── normalização ───────────────────────────────────────────────────────────

# Parênteses e instruções de formatação são ENFEITE para o leitor humano e a
# fonte de toda a divergência entre as cópias do texto. São removidos antes
# de comparar, então acrescentar ", Delta" a um exemplo — ou "(yes/no)" a uma
# pergunta — deixa de quebrar a regra correspondente.
#
# Remove-se QUALQUER grupo entre parênteses, não só os "(e.g., ...)": o
# `sample_answers.py` escrevia "Does the data have a header?" enquanto o
# frontend manda "Does the data have a header? (yes/no)". Os enunciados
# continuam distintos entre si depois disso — garantido por `_indice()`,
# que recusa colisão em tempo de importação.
_PARENTESES = re.compile(r"\([^()]*\)?")
_INSTRUCAO = re.compile(
    r"\b(?:please\s+)?list\s+(?:them|as|the)\b.*$|"
    r"\bsupported operators\b.*$|"
    r"\bseparated by\b.*$",
    re.IGNORECASE | re.DOTALL,
)
_NAO_ALFANUM = re.compile(r"[^a-z0-9]+")


def normalizar(texto: str) -> str:
    """Reduz uma pergunta ao seu enunciado, para comparação tolerante."""
    t = texto or ""
    # Repetido: um grupo pode conter outro, e cada passada remove o mais interno.
    for _ in range(4):
        novo = _PARENTESES.sub(" ", t)
        if novo == t:
            break
        t = novo
    t = _INSTRUCAO.sub(" ", t)
    t = t.lower()
    t = _NAO_ALFANUM.sub(" ", t)
    return " ".join(t.split())


def _indice() -> Tuple[Dict[str, str], Dict[str, str]]:
    """Monta os índices de busca e recusa redações ambíguas.

    Se dois enunciados diferentes colapsarem no mesmo texto normalizado, a
    resolução passaria a depender da ordem de declaração e uma resposta iria
    para a regra errada — pior que o defeito original, porque silencioso e
    plausível. Melhor falhar na importação, onde um teste pega na hora.
    """
    exatos: Dict[str, str] = {}
    normalizados: Dict[str, str] = {}
    for q in QUESTIONS:
        exatos[q.text] = q.key
        norma = normalizar(q.text)
        if norma in normalizados and normalizados[norma] != q.key:
            raise ValueError(
                f"perguntas '{normalizados[norma]}' e '{q.key}' normalizam para o "
                f"mesmo enunciado ({norma!r}); diferencie o texto fora dos parênteses"
            )
        normalizados[norma] = q.key
        for alias in q.aliases:
            exatos[alias] = q.key
            normalizados.setdefault(normalizar(alias), q.key)
    return exatos, normalizados


_EXATOS, _NORMALIZADOS = _indice()

CHAVES = frozenset(q.key for q in QUESTIONS)


def resolver_respostas(respostas: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """Traduz respostas com chave de texto livre para chaves estáveis.

    Devolve (respostas_resolvidas, não_reconhecidas). O segundo elemento é o
    que permite ao chamador avisar — em vez de descartar calado, que é
    exatamente o defeito que este módulo existe para eliminar.
    """
    resolvidas: Dict[str, Any] = {}
    desconhecidas: List[str] = []

    for chave_bruta, valor in (respostas or {}).items():
        if chave_bruta in CHAVES:
            resolvidas[chave_bruta] = valor
            continue
        chave = _EXATOS.get(chave_bruta)
        if chave is None:
            chave = _NORMALIZADOS.get(normalizar(chave_bruta))
        if chave is None:
            desconhecidas.append(chave_bruta)
            continue
        # A primeira resposta vence: se duas redações da mesma pergunta
        # vierem juntas, sobrescrever silenciosamente seria arbitrário.
        resolvidas.setdefault(chave, valor)

    return resolvidas, desconhecidas
