@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

pushd "%~dp0"

set "LOG_FILE=%~dp0deploy.log"
>"%LOG_FILE%" echo ========================================
>>"%LOG_FILE%" echo Deploy log started: %date% %time%
>>"%LOG_FILE%" echo Script: %~f0
>>"%LOG_FILE%" echo ========================================

echo Script: %~f0
echo Log: %LOG_FILE%

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

echo.
echo [BUILD] Building pages_upload folder...

REM Build pages_upload folder
echo [BUILD] Running npm run build...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    goto :fail
)
echo [OK] Build completed successfully!
echo.

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
>>"%LOG_FILE%" echo.
>>"%LOG_FILE%" echo ========================================
>>"%LOG_FILE%" echo [1/2] Worker deploy
>>"%LOG_FILE%" echo Command: !WRANGLER_CMD! deploy
>>"%LOG_FILE%" echo ========================================
cmd /c "!WRANGLER_CMD! deploy" >>"%LOG_FILE%" 2>&1
set WORKER_EXIT_CODE=%errorlevel%
if !WORKER_EXIT_CODE! neq 0 (
    echo.
    echo [ERROR] Worker deploy failed!
    echo Exit code: !WORKER_EXIT_CODE!
    echo.
    call :showlogtail
    pause
    goto :fail
)

echo.
echo [OK] Worker deployed successfully!
echo.

REM Deploy Pages
echo [2/2] Deploying Pages (fennec-swap)...
set "PAGES_DIR=pages_upload"
set "PAGES_EXTRA_FLAGS=--commit-message=Auto-Deploy --commit-dirty=true"
where git >nul 2>&1
if errorlevel 1 goto :skip_git_meta
git rev-parse --verify HEAD >nul 2>&1
if errorlevel 1 goto :skip_git_meta
set "PAGES_EXTRA_FLAGS=--commit-message=Auto-Deploy --commit-dirty=true"
:skip_git_meta

>>"%LOG_FILE%" echo.
>>"%LOG_FILE%" echo Pages deploy dir: !PAGES_DIR!

echo Command: wrangler pages deploy !PAGES_DIR! --project-name=fennec-swap !PAGES_EXTRA_FLAGS!
echo.
>>"%LOG_FILE%" echo.
>>"%LOG_FILE%" echo ========================================
>>"%LOG_FILE%" echo [2/2] Pages deploy
>>"%LOG_FILE%" echo Command: !WRANGLER_CMD! pages deploy !PAGES_DIR! --project-name=fennec-swap !PAGES_EXTRA_FLAGS!
>>"%LOG_FILE%" echo ========================================
cmd /c "!WRANGLER_CMD! pages deploy !PAGES_DIR! --project-name=fennec-swap !PAGES_EXTRA_FLAGS!" >>"%LOG_FILE%" 2>&1
set PAGES_EXIT_CODE=%errorlevel%
if !PAGES_EXIT_CODE! neq 0 (
    echo.
    echo [ERROR] Pages deploy failed!
    echo Exit code: !PAGES_EXIT_CODE!
    echo.
    call :showlogtail
    pause
    goto :fail
)

goto :after_pages

:after_pages

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

:showlogtail
echo.
echo ===== Last log lines (%LOG_FILE%) =====
powershell -NoProfile -Command "if (Test-Path -LiteralPath \"%LOG_FILE%\") { Get-Content -Tail 120 -LiteralPath \"%LOG_FILE%\" } else { Write-Host 'Log not found' }"
echo ===== End log =====
exit /b 0

:fail
call :showlogtail
echo.
echo [FAIL] Script ended with error. See log: %LOG_FILE%
pause
popd
exit /b 1
