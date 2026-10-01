@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Instalar equipo Nonno

rem ================================================================
rem  Crea en el escritorio el icono del panel de Nonno, con Chrome en
rem  modo de impresion silenciosa (sin la ventana de "Imprimir").
rem  Uso: doble clic y responder. O bien:
rem    instalar-equipo-nonno.bat cocina https://tuweb/admin/sangonera
rem ================================================================

set "ROL=%~1"
set "URL=%~2"

echo.
echo  ==============================================
echo    INSTALAR EQUIPO NONNO
echo  ==============================================
echo.

if "%ROL%"=="" (
  echo  Que ordenador es este?
  echo    1 = COCINA  ^(imprime las comandas solo^)
  echo    2 = TPV / MOSTRADOR  ^(imprime el ticket del cliente^)
  echo.
  set /p "OPC=  Escribe 1 o 2 y pulsa Enter: "
  if "!OPC!"=="1" set "ROL=cocina"
  if "!OPC!"=="2" set "ROL=tpv"
)
if /i not "%ROL%"=="cocina" if /i not "%ROL%"=="tpv" (
  echo  Opcion no valida. Vuelve a abrirlo.
  pause & exit /b 1
)

if "%URL%"=="" (
  echo.
  echo  Pega la direccion del panel de esta sede
  echo  ^(ejemplo: https://lapizzadenonno.com/admin/sangonera^)
  set /p "URL=  Direccion: "
)
if "%URL%"=="" ( echo  Falta la direccion. & pause & exit /b 1 )

rem --- Buscar Chrome ---
set "CHROME="
for %%P in (
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do if exist %%P set "CHROME=%%~P"
if "%CHROME%"=="" (
  echo.
  echo  No encuentro Google Chrome. Instalalo desde google.com/chrome y vuelve a abrir esto.
  pause & exit /b 1
)

if /i "%ROL%"=="cocina" ( set "NOMBRE=Nonno Cocina" ) else ( set "NOMBRE=Nonno TPV" )
rem Perfil de Chrome propio: funciona aunque el Chrome normal este abierto.
set "NONNO_PERFIL=%LocalAppData%\Nonno\%ROL%"
set "NONNO_CHROME=%CHROME%"
set "NONNO_URL=%URL%"
set "NONNO_NOMBRE=%NOMBRE%"

powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\'+$env:NONNO_NOMBRE+'.lnk'); $s.TargetPath=$env:NONNO_CHROME; $s.Arguments='--user-data-dir='+[char]34+$env:NONNO_PERFIL+[char]34+' --kiosk-printing --no-first-run --app='+$env:NONNO_URL; $s.IconLocation=$env:NONNO_CHROME+',0'; $s.Save()"

if /i "%ROL%"=="cocina" (
  rem La cocina arranca sola al encender el ordenador.
  powershell -NoProfile -Command "Copy-Item ([Environment]::GetFolderPath('Desktop')+'\'+$env:NONNO_NOMBRE+'.lnk') ([Environment]::GetFolderPath('Startup')) -Force"
)

echo.
echo  LISTO. Tienes en el escritorio el icono "%NOMBRE%".
if /i "%ROL%"=="cocina" echo  Ademas se abrira solo al encender el ordenador.
echo.
echo  Siguientes pasos:
echo    1. Cierra esta ventana y abre "%NOMBRE%".
echo    2. Inicia sesion en el panel ^(solo la primera vez^).
if /i "%ROL%"=="cocina" (
  echo    3. Pestana COCINA y en el menu: "Comandas automaticas: SI".
) else (
  echo    3. Pestana MOSTRADOR.
)
echo.
pause
