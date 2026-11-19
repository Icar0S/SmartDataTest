"""DSL generator module for converting user answers to DSL format."""

from .expressions import ExpressaoInvalida, compilar_expressao, dividir_regra
from .questions import resolver_respostas

# Tipos declaráveis no checklist que viram verificação de conformidade no
# código gerado. "string" fica de fora de propósito: qualquer valor é uma
# string válida, então a regra não teria como falhar.
_TIPOS_VERIFICAVEIS = {
    "integer": "integer",
    "int": "integer",
    "long": "integer",
    "bigint": "integer",
    "float": "float",
    "double": "float",
    "decimal": "float",
    "number": "float",
    "numeric": "float",
    "date": "date",
    "datetime": "timestamp",
    "timestamp": "timestamp",
    "boolean": "boolean",
    "bool": "boolean",
}


def generate_dsl(answers):
    """Generates a DSL from the user's answers."""
    dsl = {"dataset": {}, "rules": []}

    # As respostas chegam com o TEXTO DA PERGUNTA como chave. Resolver para
    # chaves estáveis antes de ler é o que impede uma diferença de redação
    # entre frontend e backend de descartar a resposta em silêncio — ver
    # questions.py, que documenta as 7 respostas perdidas por isso.
    resolvidas, desconhecidas = resolver_respostas(answers)
    for pergunta in desconhecidas:
        dsl.setdefault("warnings", []).append(
            {
                "type": "unknown_question",
                "message": (
                    f"Answer ignored: no rule is associated with the question "
                    f"'{pergunta[:120]}'."
                ),
            }
        )

    # General Information
    dataset_name = resolvidas.get("dataset_name")
    source = resolvidas.get("dataset_source")
    data_format = resolvidas.get("dataset_format", "")  # Added default empty string

    if not dataset_name:
        dsl.setdefault("errors", []).append(
            {"type": "missing_info", "message": "Dataset name is required."}
        )
    if not source:
        dsl.setdefault("errors", []).append(
            {"type": "missing_info", "message": "Data source is required."}
        )
    if not data_format:
        dsl.setdefault("errors", []).append(
            {"type": "missing_info", "message": "Data format is required."}
        )

    dsl["dataset"]["name"] = dataset_name
    dsl["dataset"]["source"] = source
    dsl["dataset"]["format"] = data_format

    # Schema Validation
    has_header_answer = resolvidas.get("has_header")
    if has_header_answer is None:
        dsl.setdefault("errors", []).append(
            {
                "type": "missing_info",
                "message": "Answer for 'Does the data have a header?' is missing.",
            }
        )
        has_header = False  # Default to False to avoid further errors
    else:
        has_header = has_header_answer.lower() == "yes"
    dsl["dataset"]["has_header"] = has_header

    column_names_str = resolvidas.get("column_names", "")
    column_names = (
        [name.strip() for name in column_names_str.split(",")] if column_names_str else []
    )

    column_types_str = resolvidas.get("column_types", "")
    column_types = [typ.strip() for typ in column_types_str.split(",")] if column_types_str else []

    if not column_names:
        dsl.setdefault("errors", []).append(
            {
                "type": "missing_info",
                "message": "Expected column names are required for schema validation.",
            }
        )
    if not column_types:
        dsl.setdefault("errors", []).append(
            {
                "type": "missing_info",
                "message": "Expected column data types are required for schema validation.",
            }
        )

    if column_names and column_types:
        if len(column_names) == len(column_types):
            dsl["dataset"]["schema"] = dict(zip(column_names, column_types))
        else:
            # Try to be more flexible - use provided types and fill with defaults
            schema = {}
            for i, col_name in enumerate(column_names):
                if i < len(column_types):
                    schema[col_name] = column_types[i]
                else:
                    # Use default type for extra columns
                    schema[col_name] = "string"

            dsl["dataset"]["schema"] = schema

            # Add a warning instead of error
            dsl.setdefault("warnings", []).append(
                {
                    "type": "schema_validation",
                    "message": f"Number of column names ({len(column_names)}) and data types ({len(column_types)}) don't match. Using provided types for first {len(column_types)} columns and 'string' for remaining {len(column_names) - len(column_types)} columns.",
                }
            )
    elif column_names:
        # If only column names provided, use default type
        dsl["dataset"]["schema"] = dict.fromkeys(column_names, "string")
        dsl.setdefault("warnings", []).append(
            {
                "type": "schema_validation",
                "message": "No data types provided. Using 'string' as default type for all columns.",
            }
        )
    elif column_types:
        # If only types provided, this is an error
        dsl.setdefault("errors", []).append(
            {
                "type": "schema_validation",
                "message": "Data types provided but no column names specified.",
            }
        )

    # O esquema declarado vira VERIFICAÇÃO, não só documentação.
    #
    # Antes, dizer que uma coluna é `integer` não gerava checagem nenhuma: o
    # tipo entrava no DSL e morria ali. Era por isso que texto numa coluna
    # numérica passava batido — "colocar string em campos numéricos não
    # quebra o código, mas ainda assim não é identificado como erro" — e por
    # isso declarar `date` não produzia nenhuma validação de data.
    for col_name, declarado in (dsl["dataset"].get("schema") or {}).items():
        esperado = _TIPOS_VERIFICAVEIS.get(str(declarado).strip().lower())
        if esperado:
            dsl["rules"].append(
                {"type": "column_type", "column": col_name, "expected_type": esperado}
            )

    # Data Integrity
    mandatory_cols_str = resolvidas.get("mandatory_columns", "")
    if mandatory_cols_str:
        mandatory_cols = [name.strip() for name in mandatory_cols_str.split(",")]
        for col_name in mandatory_cols:
            if col_name:  # Ensure column name is not empty
                dsl["rules"].append({"type": "not_null", "column": col_name})

    unique_cols_str = resolvidas.get("unique_columns", "")
    if unique_cols_str:
        unique_cols = [name.strip() for name in unique_cols_str.split(",")]
        if unique_cols:  # Ensure there are unique columns specified
            dsl["rules"].append({"type": "uniqueness", "columns": unique_cols})

    formatted_cols_str = resolvidas.get("column_formats", "")
    if formatted_cols_str:
        try:
            formatted_cols = [item.strip().split(":") for item in formatted_cols_str.split(",")]
            for item in formatted_cols:
                if len(item) == 2 and item[0] and item[1]:
                    dsl["rules"].append({"type": "format", "column": item[0], "format": item[1]})
                else:
                    dsl.setdefault("errors", []).append(
                        {
                            "type": "format_validation",
                            "message": f"Invalid format for column:format pair in '{formatted_cols_str}'. Expected 'column:format' (e.g., 'date_col:YYYY-MM-DD').",
                        }
                    )
        except Exception as e:  # pylint: disable=broad-exception-caught
            dsl.setdefault("errors", []).append(
                {
                    "type": "format_validation",
                    "message": f"Error parsing formatted columns: {e}. Input: '{formatted_cols_str}'. Expected 'column:format' (e.g., 'date_col:YYYY-MM-DD').",
                }
            )

    # Value Constraints
    range_cols_str = resolvidas.get("value_ranges", "")
    if range_cols_str:
        try:
            range_rules = [item.strip().split(":") for item in range_cols_str.split(",")]
            for rule_parts in range_rules:
                if len(rule_parts) >= 1 and rule_parts[0]:
                    col_name = rule_parts[0]
                    min_val = rule_parts[1] if len(rule_parts) > 1 and rule_parts[1] else None
                    max_val = rule_parts[2] if len(rule_parts) > 2 and rule_parts[2] else None

                    rule_dsl = {"type": "range", "column": col_name}
                    if min_val is not None:
                        try:
                            rule_dsl["min"] = float(min_val)
                        except ValueError:
                            dsl.setdefault("errors", []).append(
                                {
                                    "type": "range_validation",
                                    "message": f"Invalid minimum value '{min_val}' for column '{col_name}'. Expected a number. Input: '{range_cols_str}'.",
                                }
                            )
                            continue
                    if max_val is not None:
                        try:
                            rule_dsl["max"] = float(max_val)
                        except ValueError:
                            dsl.setdefault("errors", []).append(
                                {
                                    "type": "range_validation",
                                    "message": f"Invalid maximum value '{max_val}' for column '{col_name}'. Expected a number. Input: '{range_cols_str}'.",
                                }
                            )
                            continue
                    dsl["rules"].append(rule_dsl)
                else:
                    dsl.setdefault("errors", []).append(
                        {
                            "type": "range_validation",
                            "message": f"Invalid column specification in range constraint: '{':'.join(rule_parts)}'. Expected 'column:min:max', 'column::max', or 'column:min:'. Input: '{range_cols_str}'.",
                        }
                    )
        except Exception as e:  # pylint: disable=broad-exception-caught
            dsl.setdefault("errors", []).append(
                {
                    "type": "range_validation",
                    "message": f"Error parsing range constraints: {e}. Input: '{range_cols_str}'. Expected 'column:min:max', 'column::max', or 'column:min:'.",
                }
            )

    set_cols_str = resolvidas.get("value_sets", "")
    if set_cols_str:
        try:
            set_rules = [item.strip().split(":", 1) for item in set_cols_str.split("],")]
            for rule_parts in set_rules:
                if len(rule_parts) == 2 and rule_parts[0] and rule_parts[1]:
                    col_name = rule_parts[0]
                    values_str = rule_parts[1].replace("[", "").replace("]", "")
                    values = [v.strip().strip("'\"") for v in values_str.split(",") if v.strip()]
                    if values:
                        dsl["rules"].append(
                            {"type": "in_set", "column": col_name, "values": values}
                        )
                    else:
                        dsl.setdefault("errors", []).append(
                            {
                                "type": "set_validation",
                                "message": f"No values found for column '{col_name}' in set constraint. Input: '{rule_parts[1]}'. Expected 'column:[value1,value2]'.",
                            }
                        )
                else:
                    dsl.setdefault("errors", []).append(
                        {
                            "type": "set_validation",
                            "message": f"Invalid format for column:[values] pair in '{':'.join(rule_parts)}'. Expected 'column:[value1,value2]' (e.g., 'status:[active,inactive]'). Input: '{set_cols_str}'.",
                        }
                    )
        except Exception as e:  # pylint: disable=broad-exception-caught
            dsl.setdefault("errors", []).append(
                {
                    "type": "set_validation",
                    "message": f"Error parsing value set constraints: {e}. Input: '{set_cols_str}'. Expected 'column:[value1,value2]' (e.g., 'status:[active,inactive]').",
                }
            )

    regex_cols_str = resolvidas.get("regex_patterns", "")
    if regex_cols_str:
        try:
            # First split the string by comma, but only when not inside a regex pattern
            parts = []
            current = ""
            brace_count = 0
            for char in regex_cols_str:
                if char == "{":
                    brace_count += 1
                elif char == "}":
                    brace_count -= 1
                elif char == "," and brace_count == 0:
                    if current.strip():
                        parts.append(current.strip())
                    current = ""
                    continue
                current += char
            if current.strip():
                parts.append(current.strip())

            # Now process each part to extract column and pattern
            for part in parts:
                col_and_pattern = part.split(":", 1)
                if len(col_and_pattern) == 2 and col_and_pattern[0] and col_and_pattern[1]:
                    col_name = col_and_pattern[0].strip()
                    pattern = col_and_pattern[1].strip()
                    dsl["rules"].append({"type": "regex", "column": col_name, "pattern": pattern})
                else:
                    dsl.setdefault("errors", []).append(
                        {
                            "type": "regex_validation",
                            "message": f"Invalid format for column:pattern pair in '{part}'. Expected 'column:pattern' (e.g., 'email:^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{{2,}}$)'. Input: '{regex_cols_str}'.",
                        }
                    )
        except Exception as e:  # pylint: disable=broad-exception-caught
            dsl.setdefault("errors", []).append(
                {
                    "type": "regex_validation",
                    "message": f"Error parsing regex pattern constraints: {e}. Input: '{regex_cols_str}'. Expected 'column:pattern' (e.g., 'email:^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$)'.",
                }
            )

    value_dist_str = resolvidas.get("value_distribution", "")
    if value_dist_str:
        try:
            dist_rules = [item.strip().split(":") for item in value_dist_str.split(",")]
            for rule_parts in dist_rules:
                if len(rule_parts) == 4 and all(rule_parts):
                    col_name = rule_parts[0]
                    value = rule_parts[1]
                    min_freq = float(rule_parts[2])
                    max_freq = float(rule_parts[3])
                    dsl["rules"].append(
                        {
                            "type": "value_distribution",
                            "column": col_name,
                            "value": value,
                            "min_freq": min_freq,
                            "max_freq": max_freq,
                        }
                    )
                else:
                    dsl.setdefault("errors", []).append(
                        {
                            "type": "value_distribution_validation",
                            "message": (
                                f"Invalid format for value distribution rule: "
                                f"'{':'.join(rule_parts)}'. "
                                f"Expected 'column:value:min_freq:max_freq' "
                                f"(e.g., 'status:active:0.7:1.0'). "
                                f"Input: '{value_dist_str}'."
                            ),
                        }
                    )
        except (ValueError, IndexError) as e:
            dsl.setdefault("errors", []).append(
                {
                    "type": "value_distribution_validation",
                    "message": (
                        f"Error parsing value distribution constraints: {e}. "
                        f"Input: '{value_dist_str}'. "
                        f"Expected 'column:value:min_freq:max_freq' "
                        f"(e.g., 'status:active:0.7:1.0')."
                    ),
                }
            )

    # Cross-Column Validation
    cross_column_str = resolvidas.get("cross_column", "")
    if cross_column_str:
        try:
            cross_column_rules = [item.strip().split(":") for item in cross_column_str.split(",")]
            for rule_parts in cross_column_rules:
                if len(rule_parts) == 3 and all(rule_parts):
                    col1 = rule_parts[0]
                    operator = rule_parts[1]
                    col2 = rule_parts[2]
                    supported_operators = ["<", "<=", ">", ">=", "==", "!="]
                    if operator in supported_operators:
                        dsl["rules"].append(
                            {
                                "type": "cross_column_comparison",
                                "column1": col1,
                                "operator": operator,
                                "column2": col2,
                            }
                        )
                    else:
                        dsl.setdefault("errors", []).append(
                            {
                                "type": "cross_column_validation",
                                "message": (
                                    f"Unsupported operator '{operator}' in cross-column "
                                    f"comparison. Supported operators are: "
                                    f"{', '.join(supported_operators)}. "
                                    f"Input: '{cross_column_str}'."
                                ),
                            }
                        )
                else:
                    dsl.setdefault("errors", []).append(
                        {
                            "type": "cross_column_validation",
                            "message": (
                                f"Invalid format for cross-column comparison rule: "
                                f"'{':'.join(rule_parts)}'. "
                                f"Expected 'column1:operator:column2' "
                                f"(e.g., 'start_date:<:end_date'). "
                                f"Input: '{cross_column_str}'."
                            ),
                        }
                    )
        except Exception as e:  # pylint: disable=broad-exception-caught
            dsl.setdefault("errors", []).append(
                {
                    "type": "cross_column_validation",
                    "message": (
                        f"Error parsing cross-column comparison constraints: {e}. "
                        f"Input: '{cross_column_str}'. "
                        f"Expected 'column1:operator:column2' "
                        f"(e.g., 'start_date:<:end_date')."
                    ),
                }
            )

    # Regras de negócio: coluna calculada a partir de outras.
    #
    # Separadas por ';' e não por ',': expressões levam vírgula com
    # naturalidade em nomes de coluna e em números decimais de outras
    # localidades, e o separador precisa ser um caractere que não apareça
    # dentro da própria regra.
    business_rules_str = resolvidas.get("business_rules", "")
    if business_rules_str:
        conhecidas = list((dsl["dataset"].get("schema") or {}).keys()) or column_names
        for bruta in business_rules_str.split(";"):
            bruta = bruta.strip()
            if not bruta:
                continue
            try:
                alvo, expressao = dividir_regra(bruta)
            except ExpressaoInvalida as exc:
                dsl.setdefault("errors", []).append(
                    {"type": "business_rule_validation", "message": str(exc)}
                )
                continue

            if conhecidas and alvo not in conhecidas:
                # Checagem antecipada: sem ela a regra vira código que só
                # falha no Colab, com a coluna inexistente escondida no meio
                # de um script de centenas de linhas.
                dsl.setdefault("errors", []).append(
                    {
                        "type": "business_rule_validation",
                        "message": (
                            f"Business rule target '{alvo}' is not one of the "
                            f"declared columns. Declared: {', '.join(conhecidas)}."
                        ),
                    }
                )
                continue

            try:
                spark_expr, referenciadas = compilar_expressao(expressao, conhecidas)
            except ExpressaoInvalida as exc:
                dsl.setdefault("errors", []).append(
                    {"type": "business_rule_validation", "message": str(exc)}
                )
                continue

            dsl["rules"].append(
                {
                    "type": "computed_comparison",
                    "column": alvo,
                    "operator": "==",
                    "expression": spark_expr,
                    "expression_source": expressao,
                    "referenced_columns": referenciadas,
                    # Divisão e multiplicação em ponto flutuante não fecham na
                    # última casa: 19.99 * 3 dá 59.967000000000006. Sem
                    # tolerância, a regra reprovaria o dataset inteiro.
                    "tolerance": 0.01,
                }
            )

    return dsl
