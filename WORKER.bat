@echo off
chcp 65001 >nul 2>&1
echo ========================================
echo   FENNEC SWAP - Deploy Worker
echo ========================================
echo.

pushd "%~dp0"

echo Deploying Worker (fennec-api)...
if exist "node_modules\.bin\wrangler.cmd" (
    call "node_modules\.bin\wrangler.cmd" deploy
) else (
    call wrangler deploy
)
if %errorlevel% neq 0 (
    echo.
    echo ERROR: Worker deploy failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Worker URL: https://fennec-api.warninghejo.workers.dev
echo.
pause

popd
