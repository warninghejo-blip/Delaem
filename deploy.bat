@echo off
chcp 65001 >nul 2>&1

pushd "%~dp0"
call VSE.bat

popd
