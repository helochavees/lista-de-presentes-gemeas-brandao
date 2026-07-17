@echo off
title Cha de Bebe — Rodando
echo ============================================================
echo   Cha de Bebe — Iniciando...
echo ============================================================
echo.

REM Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    python3 --version >nul 2>&1
    if errorlevel 1 (
        echo [ERRO] Python nao encontrado.
        echo Baixe em: https://www.python.org/downloads/
        echo Marque "Add Python to PATH" durante a instalacao.
        pause
        exit /b 1
    )
    set PYTHON_CMD=python3
) else (
    set PYTHON_CMD=python
)

REM Verifica Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

REM Instala dependencias do frontend se precisar
if not exist "frontend\node_modules" (
    echo [1/3] Instalando dependencias do frontend...
    cd frontend
    call npm install
    cd ..
    echo.
) else (
    echo [1/3] Dependencias ja instaladas.
)

REM Instala Flask se precisar
%PYTHON_CMD% -c "import flask" >nul 2>&1
if errorlevel 1 (
    echo [2/3] Instalando Flask...
    %PYTHON_CMD% -m pip install flask
    echo.
) else (
    echo [2/3] Flask ja instalado.
)

REM Abre o navegador depois de 3 segundos
echo [3/3] Abrindo o navegador...
start "" cmd /c "timeout /t 3 >nul && start http://localhost:5173"

echo.
echo ============================================================
echo   O site vai abrir no navegador automaticamente.
echo   URL: http://localhost:5173
echo   Admin: http://localhost:5173/#admin (senha: gemeas0609)
echo.
echo   Para parar, feche esta janela ou aperte Ctrl+C
echo ============================================================
echo.

REM Inicia backend em background e frontend no terminal
cd backend
start "Backend - Cha de Bebe" %PYTHON_CMD% app.py
cd ..
cd frontend
call npm run dev
