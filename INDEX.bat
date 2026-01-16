@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   FENNEC SWAP - Deploy Pages (INDEX)
echo ========================================
echo.

pushd "%~dp0"

set "PAGES_DIR=."

set "WRANGLER_LOCAL=node_modules\.bin\wrangler.cmd"
set "PAGES_EXTRA_FLAGS=--commit-hash=0000000000000000000000000000000000000000 --commit-message=local --commit-dirty=true"
where git >nul 2>&1
if %errorlevel% equ 0 (
    git rev-parse --verify HEAD >nul 2>&1
    if %errorlevel% equ 0 (
        set "PAGES_EXTRA_FLAGS=--commit-dirty=true"
    )
)

echo Deploying Pages (fennec-swap)...
if exist "%WRANGLER_LOCAL%" (
    cmd /c "%WRANGLER_LOCAL% pages deploy %PAGES_DIR% --project-name=fennec-swap %PAGES_EXTRA_FLAGS%"
) else (
    cmd /c "wrangler pages deploy %PAGES_DIR% --project-name=fennec-swap %PAGES_EXTRA_FLAGS%"
)
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Pages deploy failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Pages Site: https://fennec-swap.pages.dev
echo.
pause

popd
