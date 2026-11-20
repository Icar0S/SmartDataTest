"""Tests for DSL generator module."""

import pytest
from src.dataset_inspector.dsl_generator import generate_dsl_from_metadata
from src.dataset_inspector.inspector import map_pandas_type_to_spark


def test_generate_dsl_basic():
    """Test basic DSL generation from metadata."""
    metadata = {
        'format': 'csv',
        'row_count': 100,
        'column_count': 3,
        'detected_options': {
            'encoding': 'utf-8',
            'delimiter': ',',
            'header': True
        },
        'columns': [
            {
                'name': 'id',
                'type': 'int64',
                'null_ratio': 0.0,
                'unique_ratio': 1.0,
                'min': 1,
                'max': 100
            },
            {
                'name': 'name',
                'type': 'object',
                'null_ratio': 0.02,
                'unique_ratio': 0.95,
                'avg_length': 10,
                'sample_values': ['Alice', 'Bob', 'Charlie']
            },
            {
                'name': 'score',
                'type': 'float64',
                'null_ratio': 0.1,
                'unique_ratio': 0.8,
                'min': 0.0,
                'max': 100.0,
                'mean': 75.5
            }
        ]
    }
    
    dsl = generate_dsl_from_metadata(metadata)
    
    # Check basic structure
    assert 'name' in dsl
    assert 'source' in dsl
    assert 'schema' in dsl
    assert 'rules' in dsl
    
    # Check source
    assert dsl['source']['format'] == 'csv'
    assert dsl['source']['options']['encoding'] == 'utf-8'
    assert dsl['source']['options']['delimiter'] == ','
    
    # Check schema
    assert len(dsl['schema']) == 3
    assert dsl['schema'][0]['name'] == 'id'
    assert dsl['schema'][0]['type'] == 'long'
    assert dsl['schema'][0]['nullable'] is False  # 0% nulls
    
    # Check rules - id should have not_null and uniqueness
    rule_types = [rule['type'] for rule in dsl['rules']]
    assert 'not_null' in rule_types
    assert 'uniqueness' in rule_types
    # `range` NÃO entra mais automaticamente. A faixa saía do mínimo e
    # máximo observados no próprio arquivo, e uma regra assim é tautológica:
    # nenhuma linha do dataset pode violá-la. Era a causa de "o código
    # gerado aceitou todos os casos de teste, mesmo os propositalmente
    # errados" (relatório de 2026-11-19). No lugar dela entra a
    # conformidade de tipo, que pode falhar de verdade.
    assert 'range' not in rule_types
    assert 'column_type' in rule_types


def test_generate_dsl_with_user_edits():
    """Test DSL generation with user edits."""
    metadata = {
        'format': 'csv',
        'row_count': 50,
        'column_count': 2,
        'detected_options': {'header': True},
        'columns': [
            {
                'name': 'email',
                'type': 'object',
                'null_ratio': 0.0,
                'unique_ratio': 1.0
            },
            {
                'name': 'age',
                'type': 'int64',
                'null_ratio': 0.0,
                'unique_ratio': 0.3,
                'min': 18,
                'max': 65
            }
        ]
    }
    
    user_edits = {
        'dataset_name': 'users',
        'columns': {
            'email': {
                'required': True,
                'unique': True,
                'regex_pattern': r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            },
            'age': {
                'required': True,
                'range': {'min': 18, 'max': 100}
            }
        }
    }
    
    dsl = generate_dsl_from_metadata(metadata, user_edits)
    
    # Check dataset name
    assert dsl['name'] == 'users'
    
    # Check that email has regex pattern rule
    regex_rules = [r for r in dsl['rules'] if r['type'] == 'regex' and r['column'] == 'email']
    assert len(regex_rules) == 1
    assert regex_rules[0]['pattern'] == user_edits['columns']['email']['regex_pattern']
    
    # Check that age has custom range
    range_rules = [r for r in dsl['rules'] if r['type'] == 'range' and r['column'] == 'age']
    assert len(range_rules) == 1
    assert range_rules[0]['max'] == 100


def test_generate_dsl_with_cross_validations():
    """Test DSL generation with cross-column validations."""
    metadata = {
        'format': 'csv',
        'row_count': 10,
        'column_count': 2,
        'detected_options': {'header': True},
        'columns': [
            {'name': 'start_date', 'type': 'object', 'null_ratio': 0.0, 'unique_ratio': 0.5},
            {'name': 'end_date', 'type': 'object', 'null_ratio': 0.0, 'unique_ratio': 0.5}
        ]
    }
    
    user_edits = {
        'cross_validations': [
            {
                'column1': 'start_date',
                'operator': '<',
                'column2': 'end_date'
            }
        ]
    }
    
    dsl = generate_dsl_from_metadata(metadata, user_edits)
    
    # Check cross-column validation
    cross_rules = [r for r in dsl['rules'] if r['type'] == 'cross_column_comparison']
    assert len(cross_rules) == 1
    assert cross_rules[0]['column1'] == 'start_date'
    assert cross_rules[0]['operator'] == '<'
    assert cross_rules[0]['column2'] == 'end_date'


def test_map_pandas_to_spark_type():
    """Test pandas to Spark type mapping."""
    assert map_pandas_type_to_spark('int64') == 'long'
    assert map_pandas_type_to_spark('int32') == 'integer'
    assert map_pandas_type_to_spark('float64') == 'double'
    assert map_pandas_type_to_spark('float32') == 'float'
    assert map_pandas_type_to_spark('object') == 'string'
    assert map_pandas_type_to_spark('string') == 'string'
    assert map_pandas_type_to_spark('bool') == 'boolean'
    assert map_pandas_type_to_spark('datetime64[ns]') == 'timestamp'
    assert map_pandas_type_to_spark('unknown_type') == 'string'


def test_generate_dsl_creates_dataset_section():
    """Test that DSL includes dataset section for compatibility."""
    metadata = {
        'format': 'parquet',
        'row_count': 10,
        'column_count': 1,
        'detected_options': {},
        'columns': [
            {'name': 'col1', 'type': 'int64', 'null_ratio': 0.0, 'unique_ratio': 1.0}
        ]
    }
    
    dsl = generate_dsl_from_metadata(metadata, {'dataset_name': 'test_data'})
    
    # Check dataset section exists
    assert 'dataset' in dsl
    assert dsl['dataset']['name'] == 'test_data'
    assert dsl['dataset']['format'] == 'parquet'
