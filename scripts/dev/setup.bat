@echo off
REM USO: Primeira vez ou após atualizar dependências
chcp 65001 > nul
echo ================================================
echo Configuração Inicial - Data Quality Chatbot
echo ================================================

:: Definir o diretório base do projeto (2 níveis acima de scripts/dev/)
set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%..\.."
set PROJECT_DIR=%CD%\
popd

:: Verificar versão do Python
echo [1/6] Verificando versão do Python...
python --version > nul 2>&1
if %errorlevel% neq 0 (
    echo Erro: Python não encontrado no PATH. Instale o Python 3.12+.
    pause
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo Python %PYTHON_VER% encontrado.

echo [2/6] Ativando ambiente virtual Python...
if not exist "%PROJECT_DIR%.venv\Scripts\activate.bat" (
    echo Erro: Ambiente virtual .venv não encontrado em %PROJECT_DIR%
    echo Execute: python -m venv .venv
    pause
    exit /b 1
)
call "%PROJECT_DIR%.venv\Scripts\activate.bat"

:: Verificar e instalar dependências do backend
echo [3/6] Verificando dependências do backend...
python -c "import flask" 2>nul
if %errorlevel% neq 0 (
    echo Instalando dependências do backend...
    pip install -r "%PROJECT_DIR%requirements.txt"
    if %errorlevel% neq 0 (
        echo Erro ao instalar dependências do backend.
        pause
        exit /b 1
    )
) else (
    echo Dependências do backend já instaladas.
)

:: Verificar e instalar dependências do frontend
echo [4/6] Verificando dependências do frontend...
cd "%PROJECT_DIR%frontend\"
if not exist "node_modules" (
    echo Instalando dependências do frontend...
    call npm install
    if %errorlevel% neq 0 (
        echo Erro ao instalar dependências do frontend.
        pause
        exit /b 1
    )
) else (
    echo Dependências do frontend já instaladas.
)

:: Iniciar backend
echo [5/6] Iniciando backend...
start cmd /k "title Backend && cd %PROJECT_DIR%src && %PROJECT_DIR%.venv\Scripts\python.exe api.py"

:: Aguardar backend inicializar
echo [6/6] Aguardando backend inicializar...
call :WaitForBackend 30
if %errorlevel% neq 0 (
    echo Timeout ao aguardar backend.
    pause
    exit /b 1
)

:: Iniciar frontend
start cmd /k "title Frontend && cd %PROJECT_DIR%frontend\ && npm start"

:: Aguardar frontend inicializar
echo Aguardando frontend inicializar...
set /a counter=0
:wait_frontend
timeout /t 1 /nobreak > nul
netstat -an | find ":3000" > nul
if %errorlevel% neq 0 (
    set /a counter+=1
    if %counter% lss 30 (
        echo Aguardando frontend... %counter%/30s
        goto wait_frontend
    ) else (
        echo Timeout ao aguardar frontend.
        pause
        exit /b 1
    )
)

:: Abrir navegador quando tudo estiver pronto
start http://localhost:3000

echo.
echo ================================================
echo Instalação e inicialização concluídas!
echo ------------------------------------------------
echo Para próximas execuções, use: scripts\dev\start.bat
echo ================================================
echo.
echo Serviços ativos:
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
        exit /b 1
    )
) else (
    echo Backend pronto!
    exit /b 0
)
