@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   FENNEC SWAP - Auto Fix Everything
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found! Run SETUP.bat first!
    pause
    exit /b 1
)

REM Install dependencies if needed
if not exist node_modules\ (
    echo [AUTO] Installing dependencies...
    call npm install
)

REM Auto-fix ESLint
echo [AUTO] Fixing JavaScript issues...
call npm run lint >nul 2>&1

REM Format code
echo [AUTO] Formatting code...
call npm run format >nul 2>&1

echo.
echo [OK] Auto-fix complete!
echo.
pause

