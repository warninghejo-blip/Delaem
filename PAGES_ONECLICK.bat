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
set "MANIFEST_FILE2=reinscribe_pack\fennec_manifest_live.json"
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
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$files=@('%MANIFEST_FILE%'); if(Test-Path '%MANIFEST_FILE2%'){$files+='%MANIFEST_FILE2%'}; foreach($p in $files){ $j=Get-Content $p -Raw | ConvertFrom-Json; if('%NEW_LIB%' -ne ''){$j.latest.lib='%NEW_LIB%'}; if('%NEW_CFG%' -ne ''){$j.latest.config='%NEW_CFG%'}; $addr=''; try{ if($j.inscriptions -and $j.inscriptions.Count -gt 0){ $addr=$j.inscriptions[0].address } } catch{}; if(-not $j.inscriptions){ $j | Add-Member -NotePropertyName inscriptions -NotePropertyValue @() -Force }; function upsert([string]$fn,[string]$id){ if([string]::IsNullOrWhiteSpace($id)){ return }; $x=$j.inscriptions | Where-Object { $_.filename -eq $fn } | Select-Object -First 1; if($null -ne $x){ $x.inscriptionId=$id; if($addr -and (-not $x.address)){ $x.address=$addr } } else { $j.inscriptions += [pscustomobject]@{ inscriptionId=$id; address=$addr; filename=$fn } } }; upsert 'fennec_manifest_live.json' '%NEW_MANIFEST_ID%'; upsert 'fennec_child_template_v1.html' '%NEW_CHILD_ID%'; upsert 'fennec_lib_v1.js' '%NEW_LIB%'; upsert 'fennec_config_v1.json' '%NEW_CFG%'; $j.updated_at=(Get-Date).ToUniversalTime().ToString('o'); $j | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $p }"
)

if not "%NEW_LIB%%NEW_CFG%%NEW_MANIFEST_ID%"=="" (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$files=@('inscribe_pack\\fennec_child_template_v1.html','reinscribe_pack\\fennec_child_template_v1.html','recursive_inscriptions\\fennec_child_template_v1.html'); foreach($p in $files){ if(-not (Test-Path $p)){ continue }; $s=Get-Content $p -Raw; if('%NEW_LIB%' -ne ''){ $s=[regex]::Replace($s,'(<meta name=\"fennec-lib\" content=\")[^\"]*(\"\s*/>)',('${1}%NEW_LIB%${2}')) }; if('%NEW_CFG%' -ne ''){ $s=[regex]::Replace($s,'(<meta name=\"fennec-config\" content=\")[^\"]*(\"\s*/>)',('${1}%NEW_CFG%${2}')) }; if('%NEW_MANIFEST_ID%' -ne ''){ $s=[regex]::Replace($s,"var fallbackManifestId = '[^']*';","var fallbackManifestId = '%NEW_MANIFEST_ID%';") }; Set-Content -Encoding UTF8 $p $s }"
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
echo   Deploying Cloudflare Pages...
echo ========================================

set "PAGES_DIR=.pages_upload"
if exist "!PAGES_DIR!\" (
  rmdir /s /q "!PAGES_DIR!"
)
robocopy . "!PAGES_DIR!" /E /XD node_modules backup .wrangler .git "!PAGES_DIR!" /XF img.rar *.rar >nul
set "ROBO_EXIT_CODE=%errorlevel%"
if !ROBO_EXIT_CODE! geq 8 (
  echo.
  echo [ERROR] Failed to prepare Pages upload directory (robocopy exit !ROBO_EXIT_CODE!).
  pause
  goto :fail
)

set "PAGES_EXTRA_FLAGS=--commit-hash=0000000000000000000000000000000000000000 --commit-message=local --commit-dirty=true"
where git >nul 2>&1
if !errorlevel! equ 0 (
  git rev-parse --verify HEAD >nul 2>&1
  if !errorlevel! equ 0 (
    set "PAGES_EXTRA_FLAGS=--commit-dirty=true"
  )
)

echo Command: %WRANGLER_CMD% pages deploy !PAGES_DIR! --project-name=fennec-swap %PAGES_EXTRA_FLAGS%
echo.
call %WRANGLER_CMD% pages deploy !PAGES_DIR! --project-name=fennec-swap %PAGES_EXTRA_FLAGS%
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
