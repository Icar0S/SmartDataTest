@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM  DataForgeTest - Pipeline Completa de Testes
REM  Executa: Backend (unit, api, security, integration, e2e,
REM           performance) + Frontend (unit, integration, e2e)
REM ============================================================

set "ROOT_DIR=%~dp0"
set "SRC_DIR=%ROOT_DIR%src"
set "TESTS_DIR=%ROOT_DIR%tests"
set "FRONTEND_DIR=%ROOT_DIR%frontend"
set "RESULTS_DIR=%ROOT_DIR%test-results"
set "TIMESTAMP=%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
set "TIMESTAMP=%TIMESTAMP: =0%"
set "PIPELINE_LOG=%RESULTS_DIR%\pipeline_%TIMESTAMP%.log"
set "PIPELINE_HTML=%RESULTS_DIR%\pipeline_%TIMESTAMP%.html"

set BACKEND_PASS=0
set BACKEND_FAIL=0
set FRONTEND_PASS=0
set FRONTEND_FAIL=0
set OVERALL_STATUS=0

echo.
echo ============================================================
echo  DataForgeTest - Pipeline Completa de Testes
echo  Data: %DATE% %TIME%
echo ============================================================
echo.

REM Criar diretorio de resultados
if not exist "%RESULTS_DIR%" mkdir "%RESULTS_DIR%"
if not exist "%RESULTS_DIR%\backend" mkdir "%RESULTS_DIR%\backend"
if not exist "%RESULTS_DIR%\frontend" mkdir "%RESULTS_DIR%\frontend"
if not exist "%RESULTS_DIR%\performance" mkdir "%RESULTS_DIR%\performance"

REM Verificar se Python esta disponivel
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado no PATH. Instale o Python 3.x.
    exit /b 1
)

REM Verificar se Node.js esta disponivel
node --version >nul 2>&1
if errorlevel 1 (
    echo [AVISO] Node.js nao encontrado. Testes de frontend serao ignorados.
    set SKIP_FRONTEND=1
) else (
    set SKIP_FRONTEND=0
)

REM Verificar/ativar ambiente virtual
if exist "%ROOT_DIR%.venv\Scripts\activate.bat" (
    echo [INFO] Ativando ambiente virtual ^(.venv^)...
    call "%ROOT_DIR%.venv\Scripts\activate.bat"
) else (
    echo [AVISO] Ambiente virtual nao encontrado. Usando Python do sistema.
)

REM Instalar dependencias de desenvolvimento se pytest nao estiver disponivel
python -m pytest --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] Instalando dependencias de desenvolvimento...
    pip install -r "%ROOT_DIR%requirements-dev.txt" -q
)

REM Adicionar src ao PYTHONPATH
set "PYTHONPATH=%SRC_DIR%;%ROOT_DIR%;%PYTHONPATH%"

echo.
echo ============================================================
echo  [1/7] TESTES UNITARIOS DE BACKEND
echo        tests/backend/unit/
echo ============================================================
echo.

python -m pytest "%TESTS_DIR%\backend\unit" ^
    -v ^
    --tb=short ^
    --junit-xml="%RESULTS_DIR%\backend\unit-results.xml" ^
    --html="%RESULTS_DIR%\backend\unit-report.html" ^
    --self-contained-html ^
    -q 2>nul
if errorlevel 1 (
    python -m pytest "%TESTS_DIR%\backend\unit" ^
        -v ^
        --tb=short ^
        --junit-xml="%RESULTS_DIR%\backend\unit-results.xml" ^
        -q
)

if errorlevel 1 (
    echo [FALHA] Testes unitarios de backend falharam.
    set /a BACKEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes unitarios de backend passaram.
    set /a BACKEND_PASS+=1
)

echo.
echo ============================================================
echo  [2/7] TESTES DE API DE BACKEND
echo        tests/backend/api/
echo ============================================================
echo.

python -m pytest "%TESTS_DIR%\backend\api" ^
    -v ^
    --tb=short ^
    --junit-xml="%RESULTS_DIR%\backend\api-results.xml" ^
    -q

if errorlevel 1 (
    echo [FALHA] Testes de API de backend falharam.
    set /a BACKEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes de API de backend passaram.
    set /a BACKEND_PASS+=1
)

echo.
echo ============================================================
echo  [3/7] TESTES DE SEGURANCA DE BACKEND
echo        tests/backend/security/
echo ============================================================
echo.

python -m pytest "%TESTS_DIR%\backend\security" ^
    -v ^
    --tb=short ^
    --junit-xml="%RESULTS_DIR%\backend\security-results.xml" ^
    -q

if errorlevel 1 (
    echo [FALHA] Testes de seguranca de backend falharam.
    set /a BACKEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes de seguranca de backend passaram.
    set /a BACKEND_PASS+=1
)

echo.
echo ============================================================
echo  [4/7] TESTES DE INTEGRACAO DE BACKEND
echo        tests/backend/integration/
echo ============================================================
echo.

python -m pytest "%TESTS_DIR%\backend\integration" ^
    -v ^
    --tb=short ^
    --junit-xml="%RESULTS_DIR%\backend\integration-results.xml" ^
    -q

if errorlevel 1 (
    echo [FALHA] Testes de integracao de backend falharam.
    set /a BACKEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes de integracao de backend passaram.
    set /a BACKEND_PASS+=1
)

echo.
echo ============================================================
echo  [5/7] TESTES E2E DE BACKEND
echo        tests/backend/e2e/
echo ============================================================
echo.

python -m pytest "%TESTS_DIR%\backend\e2e" ^
    -v ^
    --tb=short ^
    --junit-xml="%RESULTS_DIR%\backend\e2e-results.xml" ^
    -q

if errorlevel 1 (
    echo [FALHA] Testes E2E de backend falharam.
    set /a BACKEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes E2E de backend passaram.
    set /a BACKEND_PASS+=1
)

echo.
echo ============================================================
echo  [6/7] BENCHMARKS DE PERFORMANCE DE BACKEND
echo        tests/backend/performance/
echo        (SLAs de producao ignorados - requer RUN_PRODUCTION_TESTS=true)
echo ============================================================
echo.

python -m pytest "%TESTS_DIR%\backend\performance\test_performance_benchmarks.py" ^
    -v ^
    --tb=short ^
    --benchmark-json="%RESULTS_DIR%\performance\benchmark.json" ^
    --benchmark-sort=mean ^
    -q 2>nul
if errorlevel 1 (
    python -m pytest "%TESTS_DIR%\backend\performance\test_performance_benchmarks.py" ^
        -v ^
        --tb=short ^
        -q
)

if errorlevel 1 (
    echo [FALHA] Benchmarks de performance falharam - SLAs violados.
    set /a BACKEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Benchmarks de performance passaram - SLAs respeitados.
    set /a BACKEND_PASS+=1
)

REM ============================================================
REM  TESTES DE FRONTEND
REM ============================================================

if "%SKIP_FRONTEND%"=="1" (
    echo.
    echo [AVISO] Node.js nao disponivel - pulando testes de frontend.
    goto :SUMMARY
)

echo.
echo ============================================================
echo  [7/7] TESTES DE FRONTEND (React / Jest)
echo        frontend/src/ (unit, integration, security, e2e)
echo ============================================================
echo.

cd /d "%FRONTEND_DIR%"

REM Instalar dependencias se necessario
if not exist "node_modules" (
    echo [INFO] Instalando dependencias do frontend...
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar dependencias do frontend.
        set /a FRONTEND_FAIL+=1
        set OVERALL_STATUS=1
        goto :SUMMARY
    )
)

REM Testes unitarios do frontend
echo.
echo --- [7a] Testes Unitarios de Frontend ---
call npm test -- ^
    --watchAll=false ^
    --testPathPattern="unit|components/tests|pages/tests" ^
    --verbose ^
    --reporters=default ^
    --reporters=jest-junit 2>nul
if errorlevel 1 (
    call npm test -- ^
        --watchAll=false ^
        --testPathPattern="unit|components/tests|pages/tests" ^
        --verbose
)

if errorlevel 1 (
    echo [FALHA] Testes unitarios de frontend falharam.
    set /a FRONTEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes unitarios de frontend passaram.
    set /a FRONTEND_PASS+=1
)

REM Testes de seguranca do frontend
echo.
echo --- [7b] Testes de Seguranca de Frontend ---
call npm test -- ^
    --watchAll=false ^
    --testPathPattern="tests/frontend/security|security" ^
    --verbose

if errorlevel 1 (
    echo [FALHA] Testes de seguranca de frontend falharam.
    set /a FRONTEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes de seguranca de frontend passaram.
    set /a FRONTEND_PASS+=1
)

REM Testes de integracao do frontend
echo.
echo --- [7c] Testes de Integracao de Frontend ---
call npm test -- ^
    --watchAll=false ^
    --testPathPattern="integration|RAGIntegration" ^
    --verbose

if errorlevel 1 (
    echo [FALHA] Testes de integracao de frontend falharam.
    set /a FRONTEND_FAIL+=1
    set OVERALL_STATUS=1
) else (
    echo [OK] Testes de integracao de frontend passaram.
    set /a FRONTEND_PASS+=1
)

REM Todos os testes do frontend com cobertura
echo.
echo --- [7d] Cobertura Completa do Frontend ---
call npm test -- ^
    --watchAll=false ^
    --coverage ^
    --coverageDirectory="%RESULTS_DIR%\frontend\coverage" ^
    --coverageReporters=lcov ^
    --coverageReporters=text-summary ^
    --coverageReporters=html

if errorlevel 1 (
    echo [AVISO] Alguns testes de cobertura do frontend falharam.
) else (
    echo [OK] Relatorio de cobertura gerado em: test-results\frontend\coverage\
)

cd /d "%ROOT_DIR%"

:SUMMARY
call :build_consolidated_log
call :generate_unified_html_report
echo.
echo ============================================================
echo  SUMARIO FINAL DA PIPELINE
echo  Data: %DATE% %TIME%
echo ============================================================
echo.
echo  BACKEND:
echo    Suites passaram : %BACKEND_PASS%
echo    Suites falharam : %BACKEND_FAIL%
echo.
echo  FRONTEND:
echo    Suites passaram : %FRONTEND_PASS%
echo    Suites falharam : %FRONTEND_FAIL%
echo.
echo  Relatorios salvos em: test-results\
echo    - test-results\backend\unit-results.xml
echo    - test-results\backend\api-results.xml
echo    - test-results\backend\security-results.xml
echo    - test-results\backend\integration-results.xml
echo    - test-results\backend\e2e-results.xml
echo    - test-results\performance\benchmark.json
echo    - test-results\frontend\coverage\index.html
echo    - test-results\pipeline_%TIMESTAMP%.log
echo    - test-results\pipeline_%TIMESTAMP%.html
echo.

if "%OVERALL_STATUS%"=="0" (
    echo  STATUS: [PASSOU] Todos os testes concluidos com sucesso!
) else (
    echo  STATUS: [FALHOU] Uma ou mais suites de testes falharam.
    echo          Verifique os relatorios acima para detalhes.
)

echo ============================================================
echo.

REM Adicionar .gitignore para test-results se nao existir
if not exist "%ROOT_DIR%.gitignore" goto :END
findstr /c:"test-results" "%ROOT_DIR%.gitignore" >nul 2>&1
if errorlevel 1 (
    echo test-results/ >> "%ROOT_DIR%.gitignore"
    echo [INFO] Adicionado test-results/ ao .gitignore
)

goto :AFTER_HELPERS

:build_consolidated_log
setlocal
echo [INFO] Gerando log consolidado em: %PIPELINE_LOG%
> "%PIPELINE_LOG%" (
    echo ============================================================
    echo  DataForgeTest - Log Consolidado
    echo  Gerado em %DATE% %TIME%
    echo ============================================================
)
call :append_file_to_log "Backend - Unit" "%RESULTS_DIR%\backend\unit-results.xml"
call :append_file_to_log "Backend - API" "%RESULTS_DIR%\backend\api-results.xml"
call :append_file_to_log "Backend - Security" "%RESULTS_DIR%\backend\security-results.xml"
call :append_file_to_log "Backend - Integration" "%RESULTS_DIR%\backend\integration-results.xml"
call :append_file_to_log "Backend - E2E" "%RESULTS_DIR%\backend\e2e-results.xml"
call :append_file_to_log "Backend - Unit HTML" "%RESULTS_DIR%\backend\unit-report.html"
call :append_file_to_log "Performance Benchmarks" "%RESULTS_DIR%\performance\benchmark.json"
call :append_file_to_log "Frontend Coverage Summary" "%RESULTS_DIR%\frontend\coverage\coverage-summary.json"
call :append_file_to_log "Frontend Coverage HTML" "%RESULTS_DIR%\frontend\coverage\lcov-report\index.html"
echo [OK] Log consolidado atualizado.
endlocal
exit /b 0

:append_file_to_log
setlocal
set "SECTION_LABEL=%~1"
set "SECTION_PATH=%~2"
>> "%PIPELINE_LOG%" echo.
if exist "%SECTION_PATH%" (
    >> "%PIPELINE_LOG%" echo ---------- %SECTION_LABEL% ----------
    type "%SECTION_PATH%" >> "%PIPELINE_LOG%"
) else (
    >> "%PIPELINE_LOG%" echo [WARN] %SECTION_LABEL% ausente: %SECTION_PATH%
)
endlocal
exit /b 0

:generate_unified_html_report
setlocal
if not exist "%PIPELINE_LOG%" (
    echo [AVISO] Log consolidado inexistente - pulando geracao de HTML unico.
    endlocal
    exit /b 0
)
set "REPORT_SCRIPT=%ROOT_DIR%utilities\generate_pipeline_report.py"
if not exist "%REPORT_SCRIPT%" (
    echo [AVISO] Script %REPORT_SCRIPT% nao encontrado.
    endlocal
    exit /b 1
)
python "%REPORT_SCRIPT%" "%PIPELINE_LOG%" "%RESULTS_DIR%" "%PIPELINE_HTML%" %BACKEND_PASS% %BACKEND_FAIL% %FRONTEND_PASS% %FRONTEND_FAIL% %TIMESTAMP%
if errorlevel 1 (
    echo [AVISO] Falha ao gerar relatorio HTML consolidado.
) else (
    echo [OK] Relatorio consolidado salvo em: %PIPELINE_HTML%
)
endlocal
exit /b 0

:AFTER_HELPERS

:END
pause
exit /b %OVERALL_STATUS%
