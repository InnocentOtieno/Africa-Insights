# serve.ps1 - zero-dependency static server for the docs/ folder.
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1
# Then open:  http://localhost:8080/
param(
  [int]$Port = 8080,
  [string]$Root = "docs"
)

$ErrorActionPreference = "Stop"
$full = Join-Path $PSScriptRoot $Root
if (-not (Test-Path $full)) { Write-Host "Folder not found: $full" -ForegroundColor Red; exit 1 }
$full = (Resolve-Path $full).Path

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() }
catch { Write-Host "Could not start server on port $Port. Try a different -Port, or run PowerShell as Administrator." -ForegroundColor Red; exit 1 }

$mime = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8";
  ".js"   = "application/javascript; charset=utf-8"; ".json" = "application/json; charset=utf-8";
  ".xml"  = "application/xml; charset=utf-8"; ".txt" = "text/plain; charset=utf-8";
  ".svg"  = "image/svg+xml"; ".png" = "image/png"; ".jpg" = "image/jpeg"; ".jpeg" = "image/jpeg";
  ".gif"  = "image/gif"; ".ico" = "image/x-icon"; ".webmanifest" = "application/manifest+json"
}

Write-Host ""
Write-Host " Africa Insights is being served from:" -ForegroundColor Cyan
Write-Host "   $full"
Write-Host " Open:  http://localhost:$Port/" -ForegroundColor Green
Write-Host " Stop:  Ctrl+C"
Write-Host ""

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $reqPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      if ([string]::IsNullOrEmpty($reqPath) -or $reqPath -eq "/") { $reqPath = "/index.html" }
      $rel  = $reqPath.TrimStart("/") -replace "/", "\"
      $path = Join-Path $full $rel
      if ((Test-Path $path) -and (Get-Item $path).PSIsContainer) { $path = Join-Path $path "index.html" }
      # Directory-style URL without trailing slash -> serve its index.html (e.g. /markets/jse)
      if (-not (Test-Path $path -PathType Leaf) -and (Test-Path (Join-Path $full $rel) -PathType Container)) {
        $path = Join-Path (Join-Path $full $rel) "index.html"
      }
      if (Test-Path $path -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $ctx.Response.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" }
        $ctx.Response.Headers.Add("Cache-Control", "no-store")
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $reqPath")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
      }
    } catch {
      try { $ctx.Response.StatusCode = 500 } catch {}
    } finally {
      try { $ctx.Response.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}