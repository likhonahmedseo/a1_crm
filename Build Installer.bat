@echo off
title A1 CRM - Build Installer
cd /d "%~dp0"

:: --- Self-elevate to admin (electron-builder needs symlink privilege on Windows) ---
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo Requesting administrator rights...
    echo This is needed once so electron-builder can extract its code-signing cache.
    echo.
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ========================================
echo   A1 CRM - Build Windows Installer
echo ========================================
echo.

if not exist "node_modules" (
    echo [setup] Installing dependencies...
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

echo [build] Compiling and packaging...
echo This may take a few minutes on the first run.
echo.
call npm run build

if errorlevel 1 (
    echo.
    echo [error] Build failed.
    echo.
    echo If you see "Cannot create symbolic link" errors, either:
    echo   1. Make sure this script is running as Administrator (it should be).
    echo   2. Or enable Developer Mode in Windows Settings:
    echo      Settings -^> System -^> For developers -^> Developer Mode
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Build complete!
echo ========================================
echo.
echo Installer is in the "release" folder.
echo.

if exist "release" (
    explorer "release"
)

pause
