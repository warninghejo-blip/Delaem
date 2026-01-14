@echo off
chcp 65001 >nul
echo.
echo [1/1] Deploying to Pages...
npx wrangler pages deploy . --project-name=fennec-swap --branch=main --commit-dirty=true
echo.
echo ================================================
echo Deployment complete!
echo Production: https://main.fennec-swap.pages.dev
echo ================================================
pause
