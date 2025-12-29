@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

pushd "%~dp0"

echo Script: %~f0

echo ========================================
echo   FENNEC SWAP - Deploy All (VSE)
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    pause
    goto :fail
)

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found! Please install Node.js first.
    pause
    goto :fail
)

REM Check and install dependencies
echo [PREPARE] Checking dependencies...
if not exist node_modules\ (
    echo [INSTALL] Installing dependencies...
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install dependencies!
        pause
        goto :fail
    )
    echo [OK] Dependencies installed!
) else (
    echo [OK] Dependencies already installed.
)

set "WRANGLER_LOCAL=node_modules\.bin\wrangler.cmd"
set "WRANGLER_CMD="
if exist "%WRANGLER_LOCAL%" (
    set "WRANGLER_CMD=%WRANGLER_LOCAL%"
) else (
    where wrangler >nul 2>&1
    if %errorlevel% equ 0 (
        set "WRANGLER_CMD=wrangler"
    ) else (
        set "WRANGLER_CMD=npx wrangler"
    )
)

echo [PREPARE] Wrangler: !WRANGLER_CMD!
echo.

echo.
echo ========================================
echo   STARTING DEPLOYMENT
echo ========================================
echo.

REM Deploy Worker
echo [1/2] Deploying Worker (fennec-api)...
echo Command: wrangler deploy
echo.
call !WRANGLER_CMD! deploy
set WORKER_EXIT_CODE=%errorlevel%
if !WORKER_EXIT_CODE! neq 0 (
    echo.
    echo [ERROR] Worker deploy failed!
    echo Exit code: !WORKER_EXIT_CODE!
    echo.
    pause
    goto :fail
)

echo.
echo [OK] Worker deployed successfully!
echo.

REM Deploy Pages
echo [2/2] Deploying Pages (fennec-swap)...
set "PAGES_DIR=.pages_upload"
if exist "!PAGES_DIR!\" (
    rmdir /s /q "!PAGES_DIR!"
)
robocopy . "!PAGES_DIR!" /E /XD node_modules backup .wrangler .git "!PAGES_DIR!" /XF img.rar *.rar >nul
set "ROBO_EXIT_CODE=%errorlevel%"
if !ROBO_EXIT_CODE! geq 8 (
    echo.
    echo [ERROR] Failed to prepare Pages upload directory (robocopy exit !ROBO_EXIT_CODE!).
    pause
    goto :fail
)

set "PAGES_EXTRA_FLAGS=--commit-hash=0000000000000000000000000000000000000000 --commit-message=local --commit-dirty=true"
where git >nul 2>&1
if !errorlevel! equ 0 (
    git rev-parse --verify HEAD >nul 2>&1
    if !errorlevel! equ 0 (
        set "PAGES_EXTRA_FLAGS=--commit-dirty=true"
    )
)

echo Command: wrangler pages deploy !PAGES_DIR! --project-name=fennec-swap !PAGES_EXTRA_FLAGS!
echo.
call !WRANGLER_CMD! pages deploy !PAGES_DIR! --project-name=fennec-swap !PAGES_EXTRA_FLAGS!
set PAGES_EXIT_CODE=%errorlevel%
if !PAGES_EXIT_CODE! neq 0 (
    echo.
    echo [ERROR] Pages deploy failed!
    echo Exit code: !PAGES_EXIT_CODE!
    echo.
    pause
    goto :fail
)

echo.
echo [OK] Pages deployed successfully!

echo.
echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Worker URL: https://fennec-api.warninghejo.workers.dev
echo Pages Site: https://fennec-swap.pages.dev
echo.
echo Both Worker and Pages have been deployed successfully!
echo.
pause

popd

exit /b 0

:fail
popd
exit /b 1
