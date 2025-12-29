@echo off
chcp 65001 >nul 2>&1
setlocal

pushd "%~dp0"

echo ========================================
echo   FENNEC SWAP - Setup Secrets
echo ========================================
echo.
echo This will prompt you to paste each secret value.
echo Secrets are NOT stored in this file.
echo.

set "WRANGLER_LOCAL=node_modules\.bin\wrangler.cmd"

if exist "%WRANGLER_LOCAL%" (
  set "WRANGLER=%WRANGLER_LOCAL%"
) else (
  set "WRANGLER=wrangler"
)

echo Using: %WRANGLER%
echo.

echo [1/5] Setting UNISAT_API_KEY...
call %WRANGLER% secret put UNISAT_API_KEY
if %errorlevel% neq 0 (
  echo.
  echo ERROR: Failed to set UNISAT_API_KEY
  pause
  popd
  exit /b 1
)

echo.
echo [2/5] Setting API_KEY (optional alias for UNISAT_API_KEY)...
call %WRANGLER% secret put API_KEY

echo.
echo [3/5] Setting CMC_API_KEY (optional)...
echo If you don't have it, press Ctrl+C to cancel this secret, then rerun and skip.
echo (Cloudflare will keep existing value if already set.)
call %WRANGLER% secret put CMC_API_KEY

echo.
echo [4/5] Setting CMC_PRO_API_KEY (optional alias)...
call %WRANGLER% secret put CMC_PRO_API_KEY

echo.
echo [5/5] Setting OPENAI_API_KEY (optional, for AI chat)...
echo If you don't have it, press Ctrl+C to cancel this secret, then rerun and skip.
echo (Cloudflare will keep existing value if already set.)
call %WRANGLER% secret put OPENAI_API_KEY

echo.
echo ========================================
echo   DONE
echo ========================================
echo.
echo Next: run VSE.bat to deploy Worker + Pages.
echo.
pause

popd
