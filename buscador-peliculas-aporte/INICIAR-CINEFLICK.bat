@echo off
title CineFlick - Servidor local
cd /d "%~dp0"

echo.
echo  ========================================
echo   CineFlick - Iniciando servidor local
echo  ========================================
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  echo Abriendo en: http://localhost:5500
  echo Presiona Ctrl+C para detener el servidor.
  echo.
  start http://localhost:5500
  py -m http.server 5500
  goto :end
)

where python >nul 2>&1
if %errorlevel%==0 (
  echo Abriendo en: http://localhost:5500
  echo Presiona Ctrl+C para detener el servidor.
  echo.
  start http://localhost:5500
  python -m http.server 5500
  goto :end
)

echo No se encontro Python en tu PC.
echo.
echo OPCION A - Instalar Live Server en Cursor:
echo   1. Abre Cursor
echo   2. Presiona Ctrl+Shift+X
echo   3. Busca: Live Server
echo   4. Instala la de "Ritwick Dey"
echo   5. Clic derecho en index.html ^> Open with Live Server
echo.
echo OPCION B - Instalar Python:
echo   https://www.python.org/downloads/
echo   Luego ejecuta este archivo otra vez.
echo.
pause

:end
