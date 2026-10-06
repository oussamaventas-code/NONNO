# ════════════════════════════════════════════════════════════════
#  Instala NONNO IMPRESORA en el ordenador del local.
#  Se lanza con "INSTALAR NONNO IMPRESORA.bat" (doble clic).
#  Se puede volver a ejecutar para cambiar de impresora o de local.
# ════════════════════════════════════════════════════════════════
$ErrorActionPreference = 'Stop'
$Host.UI.RawUI.WindowTitle = 'Instalar Nonno Impresora'
$WEB = 'https://nonno-beta.vercel.app'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $env:LOCALAPPDATA 'Nonno\impresora'
New-Item -ItemType Directory -Force -Path $dir | Out-Null

function Title($t) { Write-Host ''; Write-Host "  $t" -ForegroundColor Yellow; Write-Host ('  ' + ('-' * $t.Length)) -ForegroundColor DarkYellow }
function Ask($q) { Write-Host -NoNewline "  $q "; return (Read-Host).Trim() }
function Fail($m) { Write-Host ''; Write-Host "  $m" -ForegroundColor Red; Write-Host ''; Read-Host '  Pulsa Enter para cerrar'; exit 1 }

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Red
Write-Host '     NONNO IMPRESORA · instalar en este local' -ForegroundColor White
Write-Host '  ==============================================' -ForegroundColor Red
Write-Host '  Imprime solo las comandas y los tickets, sin abrir Chrome.'

# ── 1. Local ─────────────────────────────────────────────────────
Title '1. ¿De qué local es este ordenador?'
Write-Host '     1 = Sangonera la Verde'
Write-Host '     2 = Santo Ángel'
$sede = switch (Ask 'Escribe 1 o 2 y pulsa Enter:') { '1' { 'sangonera' } '2' { 'santo-angel' } default { $null } }
if (-not $sede) { Fail 'Opción no válida. Vuelve a abrir el instalador.' }

# ── 2. Código ────────────────────────────────────────────────────
Title '2. Código de instalación'
Write-Host '     En el panel: Reparto/Mostrador › ⚙ › Impresoras › "Código de instalación".'
Write-Host '     Cópialo y pégalo aquí (clic derecho pega en esta ventana).'
$key = Ask 'Código:'
if (-not $key) { Fail 'Falta el código.' }

Write-Host '  Comprobando el código con la web…'
try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $probe = @{ action = 'poll'; location = $sede; printers = @{}; version = 'instalador' } | ConvertTo-Json -Compress
  Invoke-RestMethod -Uri "$WEB/api/print" -Method Post -Headers @{ 'x-nonno-key' = $key } -ContentType 'application/json' -Body $probe -TimeoutSec 40 | Out-Null
  Write-Host '  Código correcto.' -ForegroundColor Green
} catch {
  $code = $_.Exception.Response.StatusCode.value__
  if ($code -eq 401) { Fail 'Ese código no es el de este local. Cópialo otra vez del panel.' }
  if ($code -eq 503) { Fail 'Falta activar Nonno Impresora en la base de datos (supabase/impresora.sql).' }
  Fail "No se puede hablar con la web: $($_.Exception.Message). ¿Hay internet?"
}

# ── 3. Impresoras ────────────────────────────────────────────────
# Impresoras de tickets por USB sin driver: se crean con el driver
# "Generic / Text Only" de Windows, que deja pasar el papel tal cual.
$used = @(Get-Printer | ForEach-Object { $_.PortName })
$freeUsb = @(Get-PrinterPort | Where-Object { $_.Name -match '^USB\d+' -and $used -notcontains $_.Name } | ForEach-Object { $_.Name })
foreach ($port in $freeUsb) {
  $name = "Nonno Ticket $port"
  try {
    if (-not (Get-PrinterDriver -Name 'Generic / Text Only' -ErrorAction SilentlyContinue)) { Add-PrinterDriver -Name 'Generic / Text Only' }
    Add-Printer -Name $name -DriverName 'Generic / Text Only' -PortName $port
    Write-Host "  Encontrada una impresora USB sin instalar: creada como '$name'." -ForegroundColor Green
  } catch { }
}

$printers = @(Get-Printer | Where-Object { $_.Name -notmatch 'PDF|XPS|OneNote|Fax|Wondershare' } | Sort-Object Name)
$langs = [ordered]@{}
# Devuelve la impresora elegida y apunta en $langs si es Zebra (ZPL) o de tickets (ESC/POS)
function Pick($role, $label, $default) {
  Title $label
  for ($i = 0; $i -lt $printers.Count; $i++) {
    $p = $printers[$i]
    $zebra = if ($p.DriverName -match 'ZDesigner|Zebra|ZPL') { '  ZEBRA' } else { '' }
    Write-Host ("     {0} = {1}   ({2}){3}" -f ($i + 1), $p.Name, $p.PortName, $zebra)
  }
  Write-Host  '     R = impresora de RED (por IP, cable o WiFi)'
  if ($default) { Write-Host "     Enter = la misma que antes ($default)" }
  $a = Ask 'Elige:'
  if (-not $a -and $default) { $langs[$role] = $langs.cocina; return $default }
  if ($a -match '^[Rr]$') {
    $ip = Ask 'IP de la impresora (sale en su hoja de prueba, p. ej. 192.168.1.50):'
    if ($ip -notmatch '^\d{1,3}(\.\d{1,3}){3}(:\d+)?$') { Fail 'IP no válida.' }
    $z = Ask '¿Es una ZEBRA de etiquetas? (s/N):'
    $langs[$role] = if ($z -match '^[SsYy]') { 'zpl' } else { 'escpos' }
    return "ip:$ip"
  }
  $n = 0
  if ([int]::TryParse($a, [ref]$n) -and $n -ge 1 -and $n -le $printers.Count) {
    $p = $printers[$n - 1]
    $langs[$role] = if ($p.DriverName -match 'ZDesigner|Zebra|ZPL') { 'zpl' } else { 'escpos' }
    return $p.Name
  }
  Fail 'Opción no válida.'
}
Write-Host ''
Write-Host '  Vale cualquier impresora de tickets (rollo de 80 mm) y las Zebra de etiquetas 10x15.' -ForegroundColor Yellow
$cocina = Pick 'cocina' '3. Impresora de COCINA (comandas: entrantes, pizzas, bebidas)' $null
$mostrador = Pick 'mostrador' '4. Impresora del MOSTRADOR (ticket del cliente)' $cocina

# ── 4. Guardar e instalar ────────────────────────────────────────
$cfg = [ordered]@{ api = $WEB; location = $sede; key = $key; printers = [ordered]@{ cocina = $cocina; mostrador = $mostrador }; langs = $langs }
$cfg | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $dir 'config.json') -Encoding UTF8
Copy-Item (Join-Path $here 'agente.ps1') (Join-Path $dir 'agente.ps1') -Force

# Para la copia anterior (si la había) antes de arrancar la nueva
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -match 'Nonno\\impresora\\agente\.ps1' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$agent = Join-Path $dir 'agente.ps1'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agent`""
$atLogon = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
# Vigilante: cada 5 minutos se intenta arrancar; si ya está en marcha no hace nada
$watch = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Nonno Impresora' -Action $action -Trigger @($atLogon, $watch) -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'Nonno Impresora'

# Que el ordenador no se duerma con la tienda abierta (si Windows lo permite sin ser administrador)
try { powercfg /change standby-timeout-ac 0 | Out-Null } catch { }

Write-Host ''
Write-Host '  ==============================================' -ForegroundColor Green
Write-Host '     LISTO. Nonno Impresora está en marcha.' -ForegroundColor Green
Write-Host '  ==============================================' -ForegroundColor Green
Write-Host "  Local:      $sede"
$tipo = @{ zpl = 'Zebra, etiquetas'; escpos = 'tickets' }
Write-Host "  Cocina:     $cocina ($($tipo[$langs.cocina]))"
Write-Host "  Mostrador:  $mostrador ($($tipo[$langs.mostrador]))"
Write-Host ''
Write-Host '  - Arranca solo cada vez que se enciende el ordenador. No hay que abrir nada.'
Write-Host '  - En el panel (⚙ › Impresoras) verás "Conectada" y puedes imprimir una prueba.'
Write-Host '  - Si el ordenador se apaga, al volver imprime lo que se quedó pendiente.'
Write-Host ''
Read-Host '  Pulsa Enter para cerrar'
