"""Main chatbot module for processing user answers and generating DSL/PySpark code."""

import json
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from code_generator.pyspark_generator import generate_pyspark_code
from dsl_parser.generator import generate_dsl

from .answers import AnswerManager
from .questions import QUESTIONS


def process_chatbot_request(answers):
    """Processes user answers to generate DSL and PySpark code.

    Args:
        answers (dict): A dictionary of user answers to the chatbot questions.

    Returns:
        tuple: (dsl, pyspark_code, errors)
    """
    # Add default answers for missing keys
    answers.setdefault("What is the name of the dataset you want to validate?", "my_dataset")
    answers.setdefault(
        "What is the source of the data (e.g., a file path, a database table)?",
        "my_source",
    )
    answers.setdefault("What is the format of the data (e.g., CSV, JSON, Parquet)?", "csv")
    answers.setdefault(
        "What are the expected column names, in order? (e.g., id, first_name, last_name, email)",
        "col1,col2,col3,col4,col5,col6",
    )
    answers.setdefault(
        (
            "What is the expected data type for each column "
            "(e.g., string, integer, float, date)? Please list them in the same order "
            "as column names, separated by commas. "
            "(e.g., integer, string, string, string)"
        ),
        "string,string,string,string,string,string",
    )

    dsl = generate_dsl(answers)
    pyspark_code = generate_pyspark_code(dsl)
    errors = dsl.get("errors", [])
    warnings = dsl.get("warnings", [])
    return dsl, pyspark_code, errors, warnings


def main():
    """Main function for the chatbot (CLI version)."""
    print("Welcome to the Data Quality Chatbot!")
    answer_manager = AnswerManager()

    for section, questions in QUESTIONS.items():
        print(f"\n--- {section} ---")
        for question in questions:
            answer = input(question + " ")
            answer_manager.add_answer(question, answer)

    print("\n--- All Answers ---")
    answers = answer_manager.get_answers()
    for question, answer in answers.items():
        print(f"{question}: {answer}")

    dsl, pyspark_code, errors, warnings = process_chatbot_request(answers)

    print("\n--- Generated DSL ---")
    print(json.dumps(dsl, indent=4))
    if warnings:
        print("\n--- Warnings in DSL Generation ---")
        for warning in warnings:
            print(f"- {warning.get('type')}: {warning.get('message')}")
    if errors:
        print("\n--- Errors in DSL Generation ---")
        for error in errors:
            print(f"- {error.get('type')}: {error.get('message')}")

    save_dsl_choice = input(
        "\nWould you like to save the generated DSL to a file? (yes/no): "
    ).lower()
    if save_dsl_choice == "yes":
        filename = input("Please enter a filename for the DSL (e.g., my_rules.json): ")
        if not filename.endswith(".json"):
            filename += ".json"

        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        dsl_dir = os.path.join(project_root, "dsl")

        if not os.path.exists(dsl_dir):
            os.makedirs(dsl_dir)

        file_path = os.path.join(dsl_dir, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(dsl, f, indent=4)

        print(f"DSL saved successfully to {file_path}")

    print("\n--- Generating PySpark Code ---")
    print(pyspark_code)

    save_pyspark_choice = input(
        "\nWould you like to save the generated PySpark code to a file? (yes/no): "
    ).lower()
    if save_pyspark_choice == "yes":
        filename = input(
            "Please enter a filename for the PySpark code (e.g., data_quality_script.py): "
        )
        if not filename.endswith(".py"):
            filename += ".py"

        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        output_dir = os.path.join(project_root, "output")

        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        file_path = os.path.join(output_dir, filename)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(pyspark_code)

        print(f"PySpark code saved successfully to {file_path}")


if __name__ == "__main__":
    main()
