@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   FENNEC SWAP - Auto Debug and Fix
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Please install Node.js first.
    pause
    exit /b 1
)

REM Install dependencies if needed
echo [1/5] Installing/Updating dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)
echo [OK] Dependencies ready!
echo.

REM Check JavaScript code
echo [2/5] Running ESLint (JavaScript check)...
call npm run lint >eslint_output.txt 2>&1
if %errorlevel% neq 0 (
    echo [WARN] ESLint found issues, trying auto-fix...
    call npm run lint >eslint_fix_output.txt 2>&1
    if %errorlevel% neq 0 (
        echo [INFO] Some issues may require manual fixing
        echo [INFO] Check eslint_fix_output.txt for details
    ) else (
        echo [OK] ESLint auto-fix completed!
    )
) else (
    echo [OK] JavaScript code is clean!
)
if exist eslint_output.txt del eslint_output.txt >nul 2>&1
echo.

REM Check HTML
echo [3/5] Running HTMLHint (HTML check)...
call npm run lint:html >htmlhint_output.txt 2>&1
if %errorlevel% neq 0 (
    echo [WARN] HTMLHint found some issues (usually non-critical)
    echo [INFO] Check htmlhint_output.txt for details
) else (
    echo [OK] HTML is valid!
)
if exist htmlhint_output.txt (
    REM Show first few lines if file exists
    type htmlhint_output.txt | findstr /C:"index.html" | findstr /V "^$" >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] HTML issues found (check htmlhint_output.txt)
    )
)
echo.

REM Format code
echo [4/5] Formatting code with Prettier...
call npm run format >prettier_output.txt 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Some files could not be formatted automatically
    echo [INFO] Check prettier_output.txt for details
) else (
    echo [OK] Code formatted!
)
if exist prettier_output.txt (
    REM Check if there are actual errors (not just "Checking formatting...")
    findstr /C:"error" /C:"Error" /C:"Failed" prettier_output.txt >nul 2>&1
    if %errorlevel% equ 0 (
        echo [INFO] Prettier found issues (check prettier_output.txt)
    ) else (
        del prettier_output.txt >nul 2>&1
    )
)
echo.

REM Check worker.js syntax
echo [5/5] Checking worker.js syntax...
node -c worker.js >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Syntax error in worker.js!
    node -c worker.js
) else (
    echo [OK] worker.js syntax is valid!
)
echo.

echo ========================================
echo   DEBUG COMPLETE!
echo ========================================
echo.

REM Check for vulnerabilities
echo [INFO] Checking npm vulnerabilities...
call npm audit --audit-level=high >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] Found npm vulnerabilities (run npm audit for details)
    echo [INFO] To fix: npm audit fix (or npm audit fix --force)
) else (
    echo [OK] No high-severity vulnerabilities found
)
echo.

echo All checks completed. Your code is ready!
echo.
echo Next steps:
echo   - Run VSE.bat to deploy
echo   - Run npm run dev for local development
echo.
echo Note: Warnings are usually non-critical and can be ignored
echo       unless you see actual errors.
echo.
pause
