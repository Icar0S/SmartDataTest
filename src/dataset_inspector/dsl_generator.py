"""DSL generator from dataset metadata."""

from typing import Any, Dict, List

from .inspector import map_pandas_type_to_spark

# Tipos Spark que o código gerado sabe verificar. `string` fica de fora: todo
# valor é uma string válida, então a regra não teria como falhar.
_TIPO_VERIFICAVEL = {
    "long": "integer",
    "integer": "integer",
    "int": "integer",
    "double": "float",
    "float": "float",
    "date": "date",
    "timestamp": "timestamp",
    "boolean": "boolean",
}


def generate_dsl_from_metadata(
    metadata: Dict[str, Any], user_edits: Dict[str, Any] = None
) -> Dict[str, Any]:
    """Generate DSL from dataset metadata.

    Args:
        metadata: Dataset metadata from inspection
        user_edits: Optional user edits to override auto-detected values

    Returns:
        DSL dictionary
    """
    user_edits = user_edits or {}

    # Extract basic info
    dataset_name = user_edits.get("dataset_name", "dataset")
    file_format = metadata.get("format", "csv")
    detected_options = metadata.get("detected_options", {})

    # Build DSL structure
    dsl = {
        "name": dataset_name,
        "source": {"format": file_format, "options": detected_options},
        "schema": [],
        "transformations": [],
        "validations": [],
        "rules": [],
    }

    # Process columns
    columns = metadata.get("columns", [])
    primary_keys = []

    for col in columns:
        col_name = col["name"]
        col_type = col["type"]
        null_ratio = col.get("null_ratio", 0.0)
        unique_ratio = col.get("unique_ratio", 0.0)

        # Map type for PySpark using shared function from inspector
        spark_type = map_pandas_type_to_spark(col_type)

        # Check if user edited this column
        user_col_edits = user_edits.get("columns", {}).get(col_name, {})

        # Determine if nullable (allow override)
        nullable = user_col_edits.get("nullable", null_ratio > 0)

        # Build schema entry
        schema_entry = {
            "name": col_name,
            "type": user_col_edits.get("type", spark_type),
            "nullable": nullable,
            "stats": {"null_ratio": null_ratio, "unique_ratio": unique_ratio},
        }

        # Add numeric stats if available
        if "min" in col and "max" in col:
            schema_entry["stats"]["min"] = col["min"]
            schema_entry["stats"]["max"] = col["max"]

        dsl["schema"].append(schema_entry)

        # Auto-generate validation rules

        # 1. Not null rule for columns with very low null ratio (< 5%) or marked as required
        if null_ratio < 0.05 or user_col_edits.get("required", False):
            dsl["rules"].append({"type": "not_null", "column": col_name})

        # 2. Uniqueness rule for columns with high uniqueness (> 95%) or marked as unique
        if unique_ratio > 0.95 or user_col_edits.get("unique", False):
            primary_keys.append(col_name)
            dsl["rules"].append({"type": "uniqueness", "columns": [col_name]})

        # 3. Range rules — SOMENTE quando o usuário informa os limites.
        #
        # Antes, a faixa saía do próprio mínimo e máximo OBSERVADOS no
        # arquivo. Uma regra assim é tautológica: por construção nenhuma
        # linha do dataset pode violá-la, e o relatório de testes de
        # 2026-11-19 descreveu exatamente o efeito — *"o código gerado sem
        # validação do usuário resultou em um código que aceitou todos os
        # casos de teste, mesmo aqueles que estavam propositalmente
        # errados"*.
        #
        # Os valores observados continuam no esquema, em `stats`, que é onde
        # servem: para a pessoa decidir qual faixa faz sentido no negócio.
        user_range = user_col_edits.get("range", {})
        if user_range and (user_range.get("min") is not None or user_range.get("max") is not None):
            regra_faixa = {"type": "range", "column": col_name}
            if user_range.get("min") is not None:
                regra_faixa["min"] = user_range["min"]
            if user_range.get("max") is not None:
                regra_faixa["max"] = user_range["max"]
            dsl["rules"].append(regra_faixa)

        # 3b. Conformidade de tipo — a verificação que de fato pega dado sujo
        # sem precisar de nenhuma decisão do usuário. É o que passa a flagrar
        # texto em coluna numérica e data mal formada.
        tipo_declarado = user_col_edits.get("type", spark_type)
        tipo_verificavel = _TIPO_VERIFICAVEL.get(str(tipo_declarado).lower())
        if tipo_verificavel:
            dsl["rules"].append(
                {
                    "type": "column_type",
                    "column": col_name,
                    "expected_type": tipo_verificavel,
                }
            )

        # 4. Format validation for specific patterns
        # Formato de data reconhecido pelo inspetor vale como padrão: sem
        # isso, uma coluna de datas bem formatada não ganhava verificação
        # nenhuma até alguém digitar o formato à mão.
        user_format = user_col_edits.get("format") or col.get("date_format")
        if user_format:
            dsl["rules"].append({"type": "format", "column": col_name, "format": user_format})

        # 5. Value set validation
        user_values = user_col_edits.get("allowed_values")
        if user_values:
            dsl["rules"].append({"type": "in_set", "column": col_name, "values": user_values})

        # 6. Regex pattern validation
        user_pattern = user_col_edits.get("regex_pattern")
        if user_pattern:
            dsl["rules"].append({"type": "regex", "column": col_name, "pattern": user_pattern})

    # Add primary key metadata if detected
    if primary_keys:
        dsl["keys"] = {"primary_key": primary_keys}

    # Add user-defined cross-column validations
    cross_validations = user_edits.get("cross_validations", [])
    for cv in cross_validations:
        dsl["rules"].append(
            {
                "type": "cross_column_comparison",
                "column1": cv["column1"],
                "operator": cv["operator"],
                "column2": cv["column2"],
            }
        )

    # Add user-defined transformations
    transformations = user_edits.get("transformations", [])
    dsl["transformations"] = transformations

    # Build dataset section for compatibility with existing generator
    dsl["dataset"] = {
        "name": dataset_name,
        "format": file_format,
        "has_header": detected_options.get("header", True),
        "detected_options": detected_options,
    }

    return dsl
