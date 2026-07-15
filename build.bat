@echo off
title Build Cha de Bebe
echo ============================================================
echo   Buildando Cha-de-Bebe.exe
echo ============================================================
echo.

REM Verifica Python
python3 --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado.
    echo Baixe em: https://www.python.org/downloads/
    echo Marque "Add Python to PATH" durante a instalacao.
    pause
    exit /b 1
)

REM Verifica Node
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Node.js nao encontrado.
    echo Baixe em: https://nodejs.org/
    pause
    exit /b 1
)

REM Instala dependencias Node
echo [1/2] Instalando dependencias Node...
cd frontend
call npm install
cd ..
echo.

REM Build (frontend + venv + pyinstaller)
echo [2/2] Buildando frontend e empacotando...
python build.py
echo.

echo ============================================================
echo   PRONTO! O executavel esta na pasta: dist\
echo   Envie o arquivo Cha-de-Bebe.exe para os convidados.
echo ============================================================
pause