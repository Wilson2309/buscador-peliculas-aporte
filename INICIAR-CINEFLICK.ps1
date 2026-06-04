$port = 5502
$backendPort = 3000
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Get-NodeCommand {
  $portableNode = Get-ChildItem -Path (Join-Path $root ".tools") -Directory -Filter "node-v*-win-x64" -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending |
    Select-Object -First 1
  if ($portableNode) {
    return Join-Path $portableNode.FullName "node.exe"
  }
  $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
  if ($nodeCommand) {
    return $nodeCommand.Source
  }
  return $null
}

function Test-CineFlickBackend {
  try {
    $health = Invoke-RestMethod -Uri "http://localhost:$backendPort/api/health" -TimeoutSec 3
    return ($health.ok -eq $true)
  } catch {
    return $false
  }
}

function Stop-StaleCineFlickBackend {
  $connections = Get-NetTCPConnection -LocalPort $backendPort -ErrorAction SilentlyContinue
  if (-not $connections) { return $true }

  $projectRoot = [System.IO.Path]::GetFullPath($root)
  $stoppedAny = $false

  foreach ($processId in ($connections.OwningProcess | Sort-Object -Unique)) {
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    if (-not $process) { continue }

    $processPath = $process.Path
    $isProjectProcess = $processPath -and
      [System.IO.Path]::GetFullPath($processPath).StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)

    if ($isProjectProcess) {
      Write-Host "Cerrando backend anterior colgado en puerto $backendPort (PID $processId)..." -ForegroundColor Yellow
      Stop-Process -Id $processId -Force
      $stoppedAny = $true
    } else {
      Write-Host "El puerto $backendPort esta ocupado por otro proceso (PID $processId)." -ForegroundColor Red
      Write-Host "Cierra ese proceso o cambia PORT en backend/.env." -ForegroundColor Yellow
      return $false
    }
  }

  if ($stoppedAny) { Start-Sleep -Seconds 1 }
  return $true
}

function Start-CineFlickBackend {
  $backendRoot = Join-Path $root "backend"
  $serverFile = Join-Path $backendRoot "server.js"
  if (-not [System.IO.File]::Exists($serverFile)) { return }

  if (Test-CineFlickBackend) {
    Write-Host "Backend ya activo en: http://localhost:$backendPort" -ForegroundColor DarkGreen
    return
  }

  $activePort = Get-NetTCPConnection -LocalPort $backendPort -ErrorAction SilentlyContinue
  if ($activePort) {
    Write-Host "El puerto $backendPort esta ocupado, pero CineFlick API no responde." -ForegroundColor Yellow
    if (-not (Stop-StaleCineFlickBackend)) { return }
  }

  $node = Get-NodeCommand
  if (-not $node) {
    Write-Host "No se encontro Node.js para iniciar el backend." -ForegroundColor Yellow
    return
  }

  try {
    Start-Process -FilePath $node -ArgumentList "server.js" -WorkingDirectory $backendRoot -WindowStyle Hidden -ErrorAction Stop
  } catch {
    Write-Host "No se pudo abrir el backend en segundo plano. Usando job local..." -ForegroundColor Yellow
    Get-Job -Name CineFlickBackend -ErrorAction SilentlyContinue | Stop-Job -ErrorAction SilentlyContinue
    Get-Job -Name CineFlickBackend -ErrorAction SilentlyContinue | Remove-Job -Force -ErrorAction SilentlyContinue
    Start-Job -Name CineFlickBackend -ScriptBlock {
      param([string]$NodePath, [string]$BackendPath)
      Set-Location $BackendPath
      & $NodePath server.js
    } -ArgumentList $node, $backendRoot | Out-Null
  }

  for ($attempt = 1; $attempt -le 10; $attempt++) {
    Start-Sleep -Milliseconds 600
    if (Test-CineFlickBackend) {
      Write-Host "Backend activo en: http://localhost:$backendPort" -ForegroundColor Green
      return
    }
  }

  Write-Host "No se pudo confirmar el backend en http://localhost:$backendPort/api/health." -ForegroundColor Red
}

function Open-CineFlick {
  Start-CineFlickBackend
  Write-Host ""
  Write-Host "CineFlick activo en: http://127.0.0.1:$port" -ForegroundColor Green
  Write-Host "Presiona Ctrl+C para detener." -ForegroundColor Yellow
  Write-Host ""
  Start-Process "http://127.0.0.1:$port"
}

function Start-PythonServer {
  param([string]$Command)
  Open-CineFlick
  Invoke-Expression "$Command -m http.server $port --bind 127.0.0.1"
}

function Get-ContentType {
  param([string]$Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".css" { "text/css; charset=utf-8" }
    ".js" { "application/javascript; charset=utf-8" }
    ".png" { "image/png" }
    ".jpg" { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".svg" { "image/svg+xml" }
    default { "application/octet-stream" }
  }
}

function Start-PowerShellServer {
  Open-CineFlick
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $port)
  $listener.Start()

  try {
    while ($true) {
      $client = $listener.AcceptTcpClient()
      try {
        $stream = $client.GetStream()
        $reader = [System.IO.StreamReader]::new($stream)
        $requestLine = $reader.ReadLine()

        while ($true) {
          $line = $reader.ReadLine()
          if ([string]::IsNullOrEmpty($line)) { break }
        }

        $urlPath = "/"
        if ($requestLine -match "^[A-Z]+\s+([^\s]+)") {
          $urlPath = $Matches[1].Split("?")[0]
        }

        $relativePath = [System.Uri]::UnescapeDataString($urlPath.TrimStart("/"))
        if ([string]::IsNullOrWhiteSpace($relativePath)) {
          $relativePath = "index.html"
        }

        $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $relativePath))
        $rootPath = [System.IO.Path]::GetFullPath($root)

        if (-not $fullPath.StartsWith($rootPath) -or -not [System.IO.File]::Exists($fullPath)) {
          $status = "404 Not Found"
          $contentType = "text/plain; charset=utf-8"
          $bytes = [System.Text.Encoding]::UTF8.GetBytes("Archivo no encontrado")
        } else {
          $status = "200 OK"
          $contentType = Get-ContentType $fullPath
          $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        }

        $header = "HTTP/1.1 $status`r`nContent-Type: $contentType`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
        $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($headerBytes, 0, $headerBytes.Length)
        $stream.Write($bytes, 0, $bytes.Length)
      } finally {
        $client.Close()
      }
    }
  } finally {
    $listener.Stop()
  }
}

if (Get-Command py -ErrorAction SilentlyContinue) {
  $pyVersion = & py --version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Start-PythonServer "py"
    exit
  }
}

if (Get-Command python -ErrorAction SilentlyContinue) {
  $pythonVersion = & python --version 2>$null
  if ($LASTEXITCODE -eq 0) {
    Start-PythonServer "python"
    exit
  }
}

Start-PowerShellServer
