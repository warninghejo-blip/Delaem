@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

pushd "%~dp0"
echo ========================================
echo   FENNEC - One-Click Pages Deploy
echo   (manifest_live.json + wrangler pages)
echo ========================================
echo.

set "MANIFEST_FILE=recursive_inscriptions\fennec_manifest_live.json"
set "INDEX_FILE=index.html"
if not exist "%MANIFEST_FILE%" (
  echo [ERROR] Not found: %MANIFEST_FILE%
  echo Run from repo root.
  pause
  goto :fail
)

REM Detect wrangler
set "WRANGLER_LOCAL=node_modules\.bin\wrangler.cmd"
set "WRANGLER_CMD="
if exist "%WRANGLER_LOCAL%" (
  set "WRANGLER_CMD=%WRANGLER_LOCAL%"
) else (
  where wrangler >nul 2>&1
  if %errorlevel% equ 0 (
    set "WRANGLER_CMD=wrangler"
  ) else (
    set "WRANGLER_CMD=npx wrangler"
  )
)

echo Wrangler: %WRANGLER_CMD%
echo.

echo Current %MANIFEST_FILE%:
type "%MANIFEST_FILE%"
echo.

set /p NEW_MANIFEST_ID="Enter new manifest inscriptionId (leave empty to keep): "
set /p NEW_CHILD_ID="Enter new child template inscriptionId (leave empty to keep): "
set /p NEW_LIB="Enter new latest.lib inscriptionId (leave empty to keep): "
set /p NEW_CFG="Enter new latest.config inscriptionId (leave empty to keep): "

if not "%NEW_MANIFEST_ID%%NEW_CHILD_ID%%NEW_LIB%%NEW_CFG%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%MANIFEST_FILE%'; $j=Get-Content $p -Raw | ConvertFrom-Json; if('%NEW_LIB%' -ne ''){$j.latest.lib='%NEW_LIB%'}; if('%NEW_CFG%' -ne ''){$j.latest.config='%NEW_CFG%'}; $addr=''; try{ if($j.inscriptions -and $j.inscriptions.Count -gt 0){ $addr=$j.inscriptions[0].address } } catch{}; if(-not $j.inscriptions){ $j | Add-Member -NotePropertyName inscriptions -NotePropertyValue @() -Force }; function upsert([string]$fn,[string]$id){ if([string]::IsNullOrWhiteSpace($id)){ return }; $x=$j.inscriptions | Where-Object { $_.filename -eq $fn } | Select-Object -First 1; if($null -ne $x){ $x.inscriptionId=$id; if($addr -and (-not $x.address)){ $x.address=$addr } } else { $j.inscriptions += [pscustomobject]@{ inscriptionId=$id; address=$addr; filename=$fn } } }; upsert 'fennec_manifest_live.json' '%NEW_MANIFEST_ID%'; upsert 'fennec_child_template_v1.html' '%NEW_CHILD_ID%'; upsert 'fennec_lib_v1.js' '%NEW_LIB%'; upsert 'fennec_config_v1.json' '%NEW_CFG%'; $j.updated_at=(Get-Date).ToUniversalTime().ToString('o'); $j | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $p"
)

if not "%NEW_LIB%%NEW_CFG%%NEW_MANIFEST_ID%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='recursive_inscriptions\\fennec_child_template_v1.html'; if(-not (Test-Path $p)){ exit 0 }; $s=Get-Content $p -Raw; if('%NEW_LIB%' -ne ''){ $s=[regex]::Replace($s,'(<meta name=\"fennec-lib\" content=\")[^\"]*(\"\s*/>)',('${1}%NEW_LIB%${2}')) }; if('%NEW_CFG%' -ne ''){ $s=[regex]::Replace($s,'(<meta name=\"fennec-config\" content=\")[^\"]*(\"\s*/>)',('${1}%NEW_CFG%${2}')) }; if('%NEW_MANIFEST_ID%' -ne ''){ $s=[regex]::Replace($s,\"var fallbackManifestId = '[^']*';\",\"var fallbackManifestId = '%NEW_MANIFEST_ID%';\") }; Set-Content -Encoding UTF8 $p $s"
)

if not "%NEW_LIB%%NEW_CFG%%NEW_MANIFEST_ID%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%INDEX_FILE%'; if(-not (Test-Path $p)){ exit 0 }; $s=Get-Content $p -Raw; if('%NEW_LIB%' -ne ''){ $s=[regex]::Replace($s,"const FALLBACK_CHILD_LIB = '[^']*';","const FALLBACK_CHILD_LIB = '%NEW_LIB%';") }; if('%NEW_CFG%' -ne ''){ $s=[regex]::Replace($s,"const FALLBACK_CHILD_CONFIG = '[^']*';","const FALLBACK_CHILD_CONFIG = '%NEW_CFG%';") }; if('%NEW_MANIFEST_ID%' -ne ''){ $s=[regex]::Replace($s,"var fallbackManifestId = '[^']*';","var fallbackManifestId = '%NEW_MANIFEST_ID%';") }; Set-Content -Encoding UTF8 $p $s"
)

REM If user entered something, patch JSON using PowerShell (safe, no external deps)
if not "%NEW_LIB%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%MANIFEST_FILE%'; $j=Get-Content $p -Raw | ConvertFrom-Json; $j.latest.lib='%NEW_LIB%'; $j.updated_at=(Get-Date).ToUniversalTime().ToString('o'); $j | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $p"
)
if not "%NEW_CFG%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$p='%MANIFEST_FILE%'; $j=Get-Content $p -Raw | ConvertFrom-Json; $j.latest.config='%NEW_CFG%'; $j.updated_at=(Get-Date).ToUniversalTime().ToString('o'); $j | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $p"
)

echo.
echo Updated %MANIFEST_FILE%:
type "%MANIFEST_FILE%"
echo.
echo ========================================
echo   Building and Deploying Cloudflare Pages...
echo ========================================

echo [BUILD] Building pages_upload folder...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build failed!
    pause
    goto :fail
)
echo [OK] Build completed!
echo.

set "PAGES_DIR=pages_upload"
set "PAGES_EXTRA_FLAGS=--commit-message=Auto-Deploy --commit-dirty=true"

echo Command: %WRANGLER_CMD% pages deploy !PAGES_DIR! --project-name=fennec-swap %PAGES_EXTRA_FLAGS%
echo.
cmd /c "%WRANGLER_CMD% pages deploy !PAGES_DIR! --project-name=fennec-swap %PAGES_EXTRA_FLAGS%"
if %errorlevel% neq 0 (
  echo.
  echo [ERROR] Pages deploy failed.
  pause
  goto :fail
)

echo.
echo [OK] Pages deployed.
echo URL should serve manifest at:
echo   https://fennecbtc.xyz/recursive_inscriptions/fennec_manifest_live.json
echo.
pause
popd
exit /b 0

:fail
popd
exit /b 1
