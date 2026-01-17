@echo off
chcp 65001 >nul
pushd "%~dp0"

echo.
echo [BUILD] Building pages_upload folder...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)
echo [OK] Build completed!
echo.

echo [1/1] Deploying to Pages...
npx wrangler pages deploy pages_upload --project-name=fennec-swap --branch=main --commit-message=Auto-Deploy --commit-dirty=true
echo.
echo ================================================
echo Deployment complete!
echo Production: https://main.fennec-swap.pages.dev
echo ================================================
pause

popd
