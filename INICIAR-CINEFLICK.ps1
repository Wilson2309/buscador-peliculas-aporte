$port = 5502
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

function Open-CineFlick {
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
