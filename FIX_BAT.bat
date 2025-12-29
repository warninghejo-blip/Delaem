@echo off
chcp 65001 >nul 2>&1
echo Fixing bat files to prevent auto-close...
echo.

REM Add pause to all bat files if they don't have it
for %%f in (*.bat) do (
    findstr /C:"pause" "%%f" >nul
    if errorlevel 1 (
        echo Adding pause to %%f
        echo. >> "%%f"
        echo pause >> "%%f"
    )
)

echo.
echo Done! All bat files should now have pause at the end.
pause

