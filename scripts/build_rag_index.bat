@echo off
REM Build (or rebuild) the RAG vector store from docs_to_import/
REM
REM Usage:
REM   scripts\build_rag_index.bat           -- build if not yet built
REM   scripts\build_rag_index.bat --rebuild  -- wipe and rebuild from scratch
chcp 65001 > nul

:: Resolve project root (parent of scripts/)
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%.."
set PROJECT_DIR=%CD%
popd

echo ============================================================
echo  RAG Index Builder
echo ============================================================
echo  Project : %PROJECT_DIR%
echo  Source  : %PROJECT_DIR%\docs_to_import
echo  Output  : %PROJECT_DIR%\storage\vectorstore\documents.json
echo ============================================================

:: Activate virtual environment
if exist "%PROJECT_DIR%\.venv\Scripts\activate.bat" (
    call "%PROJECT_DIR%\.venv\Scripts\activate.bat"
) else (
    echo [WARNING] .venv not found — using system Python
)

:: Run the Python build script, forwarding any arguments (e.g. --rebuild)
"%PROJECT_DIR%\.venv\Scripts\python.exe" "%PROJECT_DIR%\scripts\build_rag_index.py" %*
if errorlevel 1 (
    echo [ERROR] RAG index build failed.
    exit /b 1
)

echo.
echo [OK] RAG index ready.
