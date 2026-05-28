@echo off
title CineFlick - Servidor local
cd /d "%~dp0"

echo.
echo  ========================================
echo   CineFlick - Iniciando servidor local
echo  ========================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0INICIAR-CINEFLICK.ps1"

pause
