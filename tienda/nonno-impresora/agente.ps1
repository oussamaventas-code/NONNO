# ════════════════════════════════════════════════════════════════
#  NONNO IMPRESORA · programa del local
#
#  Pregunta sin parar a la web si hay papeles para este local
#  (comandas, tickets, avisos de cancelado) y los manda tal cual a la
#  impresora: por USB (impresora de Windows) o por red (IP:9100).
#  Cada vez que pregunta, la web sabe que está vivo; si se calla con
#  la tienda abierta, al jefe le llega un aviso al móvil.
#
#  Lo arranca Windows al iniciar sesión (tarea "Nonno Impresora").
#  Configuración: %LOCALAPPDATA%\Nonno\impresora\config.json
#  Registro:      %LOCALAPPDATA%\Nonno\impresora\registro.txt
# ════════════════════════════════════════════════════════════════

$ErrorActionPreference = 'Stop'
$VERSION = '1.0'
$dir = Join-Path $env:LOCALAPPDATA 'Nonno\impresora'
$cfgPath = Join-Path $dir 'config.json'
$logPath = Join-Path $dir 'registro.txt'

function Log([string]$msg) {
  try {
    if ((Test-Path $logPath) -and (Get-Item $logPath).Length -gt 1MB) { Move-Item $logPath "$logPath.anterior" -Force }
    Add-Content -Path $logPath -Value ("{0:yyyy-MM-dd HH:mm:ss}  {1}" -f (Get-Date), $msg) -Encoding UTF8
  } catch { }
}

# Una sola copia a la vez: dos programas imprimirían todo dos veces
$mutex = New-Object System.Threading.Mutex($false, 'Global\NonnoImpresora')
if (-not $mutex.WaitOne(0)) { exit 0 }

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class NonnoRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO { public string pDocName; public string pOutputFile; public string pDataType; }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool OpenPrinter(string name, out IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)] static extern int StartDocPrinter(IntPtr h, int level, DOCINFO di);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError = true)] static extern bool WritePrinter(IntPtr h, byte[] buf, int len, out int written);
  public static void Send(string printer, string doc, byte[] data) {
    IntPtr h;
    if (!OpenPrinter(printer, out h, IntPtr.Zero)) throw new Exception("No encuentro la impresora '" + printer + "' (" + Marshal.GetLastWin32Error() + ")");
    try {
      var di = new DOCINFO { pDocName = doc, pDataType = "RAW" };
      if (StartDocPrinter(h, 1, di) == 0) throw new Exception("No se pudo empezar a imprimir (" + Marshal.GetLastWin32Error() + ")");
      StartPagePrinter(h);
      int w;
      bool ok = WritePrinter(h, data, data.Length, out w);
      EndPagePrinter(h); EndDocPrinter(h);
      if (!ok || w != data.Length) throw new Exception("La impresora no aceptó el papel (" + Marshal.GetLastWin32Error() + ")");
    } finally { ClosePrinter(h); }
  }
}
"@

# "ip:192.168.1.50" o "ip:192.168.1.50:9100" = impresora de red; si no, nombre de Windows
function Send-Paper([string]$target, [string]$doc, [byte[]]$data) {
  if ($target -match '^ip:([^:]+)(?::(\d+))?$') {
    $port = if ($Matches[2]) { [int]$Matches[2] } else { 9100 }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $iar = $client.BeginConnect($Matches[1], $port, $null, $null)
      if (-not $iar.AsyncWaitHandle.WaitOne(4000)) { throw "La impresora $($Matches[1]) no contesta en la red" }
      $client.EndConnect($iar)
      $stream = $client.GetStream(); $stream.WriteTimeout = 8000
      $stream.Write($data, 0, $data.Length); $stream.Flush()
    } finally { $client.Close() }
  } else {
    [NonnoRaw]::Send($target, $doc, $data)
  }
}

# Cómo está cada impresora (se manda a la web para el panel)
function Printer-State([string]$target) {
  if (-not $target) { return @{ ok = $false; status = 'sin asignar' } }
  if ($target -match '^ip:([^:]+)(?::(\d+))?$') {
    $port = if ($Matches[2]) { [int]$Matches[2] } else { 9100 }
    $client = New-Object System.Net.Sockets.TcpClient
    try {
      $iar = $client.BeginConnect($Matches[1], $port, $null, $null)
      $ok = $iar.AsyncWaitHandle.WaitOne(1500) -and $client.Connected
      return @{ ok = [bool]$ok; status = $(if ($ok) { 'conectada' } else { 'no contesta en la red' }); name = $target }
    } catch { return @{ ok = $false; status = 'no contesta en la red'; name = $target } } finally { $client.Close() }
  }
  try {
    $p = Get-Printer -Name $target -ErrorAction Stop
    $stuck = @(Get-PrintJob -PrinterName $target -ErrorAction SilentlyContinue).Count
    $st = "$($p.PrinterStatus)"
    $ok = ($st -eq 'Normal' -or $st -eq 'Printing') -and $stuck -lt 3
    $label = if ($stuck -ge 3) { "$stuck papeles atascados en Windows" } elseif ($ok) { 'conectada' } else { $st }
    return @{ ok = [bool]$ok; status = $label; name = $target }
  } catch { return @{ ok = $false; status = 'no existe en Windows'; name = $target } }
}

Log "Arranca Nonno Impresora $VERSION"
$lastCfg = $null
while ($true) {
  try {
    $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($cfg.location -ne $lastCfg) { Log "Local: $($cfg.location) · cocina: $($cfg.printers.cocina) · mostrador: $($cfg.printers.mostrador)"; $lastCfg = $cfg.location }
    $headers = @{ 'x-nonno-key' = $cfg.key }
    $url = "$($cfg.api.TrimEnd('/'))/api/print"

    $states = @{ cocina = (Printer-State $cfg.printers.cocina); mostrador = (Printer-State $cfg.printers.mostrador) }
    $body = @{ action = 'poll'; location = $cfg.location; printers = $states; version = $VERSION } | ConvertTo-Json -Depth 4 -Compress
    $r = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 45

    $results = @()
    foreach ($job in @($r.jobs)) {
      if (-not $job) { continue }
      $target = $cfg.printers.($job.role)
      if (-not $target) { $target = $cfg.printers.cocina }
      try {
        Send-Paper $target "Nonno $($job.kind) $($job.ref)" ([Convert]::FromBase64String($job.data))
        $results += @{ id = $job.id; ok = $true }
        Log "Impreso $($job.kind) $($job.ref) en $target"
      } catch {
        $results += @{ id = $job.id; ok = $false; error = $_.Exception.Message }
        Log "FALLO $($job.kind) $($job.ref) en ${target}: $($_.Exception.Message)"
      }
    }
    if ($results.Count) {
      $ack = @{ action = 'ack'; location = $cfg.location; results = $results } | ConvertTo-Json -Depth 4 -Compress
      Invoke-RestMethod -Uri $url -Method Post -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($ack)) -TimeoutSec 20 | Out-Null
      if (@($results | Where-Object { -not $_.ok }).Count) { Start-Sleep -Seconds 5 }
    }
  } catch {
    Log "Sin conexión o error: $($_.Exception.Message)"
    Start-Sleep -Seconds 5
  }
}
