@echo off
REM USO: Uso diário após já ter rodado setup.bat
chcp 65001 > nul
echo =====================================
echo Inicialização Rápida - Modo Dev
echo =====================================

:: Definir o diretório base do projeto (2 níveis acima de scripts/dev/)
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%..\.."
set PROJECT_DIR=%CD%\
popd

:: Verificar se .venv existe
if not exist "%PROJECT_DIR%.venv\Scripts\activate.bat" (
    echo Erro: Ambiente virtual .venv não encontrado.
    echo Execute primeiro: scripts\dev\setup.bat
    pause
    exit /b 1
)

:: Ativar ambiente virtual Python
call "%PROJECT_DIR%.venv\Scripts\activate.bat"

:: ── RAG Index: build once, reuse forever ─────────────────────────────────────
set RAG_INDEX=%PROJECT_DIR%storage\vectorstore\documents.json
if not exist "%RAG_INDEX%" (
    echo [RAG] Índice RAG não encontrado. Construindo a partir de docs_to_import/...
    echo [RAG] Isso ocorre apenas na primeira execucao ou apos --rebuild.
    call "%PROJECT_DIR%scripts\build_rag_index.bat"
    if errorlevel 1 (
        echo [AVISO] Falha ao construir índice RAG. O backend usará fallback.
    ) else (
        echo [RAG] Índice pronto.
    )
) else (
    echo [RAG] Índice RAG já existe — carregando do cache.
)
echo.

:: Iniciar backend em uma nova janela
echo [1/3] Iniciando backend...
start cmd /k "title Backend && cd %PROJECT_DIR%src && %PROJECT_DIR%.venv\Scripts\python.exe api.py"

:: Aguardar backend verificando health check
echo [2/3] Aguardando backend iniciar...
call :WaitForBackend 15

:: Iniciar frontend
echo [3/3] Iniciando frontend...
start cmd /k "title Frontend && cd %PROJECT_DIR%frontend\ && npm start"

echo.
echo Serviços iniciados!
echo - Backend: http://localhost:5000
echo - Frontend: http://localhost:3000
echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
goto :EOF

:WaitForBackend
set /a counter=0
set /a max_wait=%~1
:wb_loop
timeout /t 1 /nobreak > nul
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; exit 0 } catch { exit 1 }" > nul 2>&1
if %errorlevel% neq 0 (
    set /a counter+=1
    if %counter% lss %max_wait% (
        echo Aguardando backend... %counter%/%max_wait%s
        goto wb_loop
    ) else (
        echo AVISO: Backend nao respondeu em %max_wait%s, continuando mesmo assim...
        exit /b 0
    )
) else (
    echo Backend pronto!
    exit /b 0
)
