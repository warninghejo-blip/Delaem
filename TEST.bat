@echo off
chcp 65001 >nul 2>&1
echo Testing batch file syntax...
echo.
echo Node.js check:
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo Node.js NOT found
) else (
    echo Node.js found
    node --version
)
echo.
echo npm check:
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo npm NOT found
) else (
    echo npm found
    npm --version
)
echo.
echo Test complete!
pause

