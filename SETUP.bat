@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo ========================================
echo   FENNEC SWAP - Initial Setup
echo ========================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Required version: 18.0.0 or higher
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js found
node --version
echo.

REM Check npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] npm not found!
    pause
    exit /b 1
)

echo [OK] npm found
npm --version
echo.

REM Install dependencies
echo [SETUP] Installing all dependencies...
echo This may take a few minutes...
echo.
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install dependencies!
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo.
echo [OK] All dependencies installed successfully!
echo.
if exist "node_modules\.bin\wrangler.cmd" (
    echo [OK] Wrangler is available locally.
) else (
    echo [WARN] Wrangler not found in node_modules.
    echo [INFO] Try running: npm install
)

echo.

REM Create .gitignore if not exists
if not exist .gitignore (
    echo [SETUP] Creating .gitignore...
    (
        echo node_modules/
        echo .wrangler/
        echo .env
        echo *.log
    ) > .gitignore
)

echo ========================================
echo   SETUP COMPLETE!
echo ========================================
echo.
echo Your project is ready to use!
echo.
echo Available commands:
echo   - DEBUG.bat    : Auto-check and fix code
echo   - VSE.bat      : Deploy Worker + Pages
echo   - WORKER.bat   : Deploy Worker only
echo   - INDEX.bat    : Deploy Pages only
echo   - npm run dev  : Start local dev server
echo.
echo Next: Run DEBUG.bat to check your code!
echo.
pause

