$port = 5500
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Start-PythonServer {
  param([string]$Command)
  Write-Host ""
  Write-Host "CineFlick activo en: http://localhost:$port" -ForegroundColor Green
  Write-Host "Presiona Ctrl+C para detener." -ForegroundColor Yellow
  Write-Host ""
  Start-Process "http://localhost:$port"
  Invoke-Expression "$Command -m http.server $port"
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  Start-PythonServer "py"
  exit
}

if (Get-Command python -ErrorAction SilentlyContinue) {
  Start-PythonServer "python"
  exit
}

Write-Host "Python no encontrado." -ForegroundColor Red
Write-Host ""
Write-Host "Instala Live Server en Cursor:" -ForegroundColor Cyan
Write-Host "  Ctrl+Shift+X -> buscar 'Live Server' -> Instalar (Ritwick Dey)"
Write-Host "  Clic derecho en index.html -> Open with Live Server"
Write-Host ""
Read-Host "Presiona Enter para cerrar"
