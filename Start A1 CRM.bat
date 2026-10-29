@echo off
title A1 CRM Launcher
cd /d "%~dp0"

echo ========================================
echo   A1 CRM - by A1 Technovation
echo ========================================
echo.

if not exist "node_modules" (
    echo [setup] First run detected. Installing dependencies...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [error] npm install failed. Make sure Node.js is installed.
        pause
        exit /b 1
    )
    echo.
)

echo [start] Launching A1 CRM...
echo.
call npm run dev

if errorlevel 1 (
    echo.
    echo [error] App exited with an error.
    pause
)
