@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
title Instalar Nonno en este ordenador

rem ================================================================
rem  Crea en el escritorio un icono del panel de Nonno con Chrome en
rem  impresion silenciosa (sin la ventana de "Imprimir").
rem
rem  Cada icono es un Chrome aparte que recuerda SU impresora. En el
rem  TPV se ejecuta DOS veces: una para COCINA (comandas solas a la
rem  impresora de cocina) y otra para TPV (ticket del cliente a la del
rem  mostrador).
rem
rem  Uso: doble clic y responder. O bien:
rem    instalar-equipo-nonno.bat cocina https://nonno-beta.vercel.app/admin/sangonera
rem ================================================================

set "ROL=%~1"
set "URL=%~2"
set "AQUI=%~dp0"
rem Direccion de la web. Si algun dia cambia el dominio, se cambia solo aqui.
set "WEB=https://nonno-beta.vercel.app"

echo.
echo  ==============================================
echo    INSTALAR NONNO EN ESTE ORDENADOR
echo  ==============================================
echo.

if "%ROL%"=="" (
  echo  Que quieres montar?
  echo    1 = COCINA   ^(las comandas salen solas en la impresora de cocina^)
  echo    2 = TPV      ^(el ticket del cliente sale solo en la impresora del mostrador^)
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
  echo  De que local es este ordenador?
  echo    1 = SANGONERA LA VERDE
  echo    2 = SANTO ANGEL
  echo.
  set /p "SEDE=  Escribe 1 o 2 y pulsa Enter: "
  if "!SEDE!"=="1" set "URL=%WEB%/admin/sangonera"
  if "!SEDE!"=="2" set "URL=%WEB%/admin/santo-angel"
)
rem Sin espacios sueltos: un espacio delante rompe el icono
set "URL=%URL: =%"
if "%URL%"=="" ( echo  Opcion no valida. Vuelve a abrirlo. & pause & exit /b 1 )
echo.
echo  Panel: %URL%

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

if /i "%ROL%"=="cocina" (
  set "NOMBRE=Nonno Cocina"
  set "IMPRESORA=la impresora de COCINA"
  rem Que Chrome no la frene aunque este minimizada detras del TPV.
  set "EXTRA=--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows"
) else (
  set "NOMBRE=Nonno TPV"
  set "IMPRESORA=la impresora del MOSTRADOR"
  set "EXTRA=--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows"
)

set "NONNO_PERFIL=%LocalAppData%\Nonno\%ROL%"
set "NONNO_CHROME=%CHROME%"
rem El panel se monta solo con ?equipo=cocina o ?equipo=tpv
set "SEP=?"
if not "%URL:?=%"=="%URL%" set "SEP=&"
set "NONNO_URL=%URL%%SEP%equipo=%ROL%"
set "NONNO_NOMBRE=%NOMBRE%"
set "NONNO_EXTRA=%EXTRA%"

rem --- Paso 1: elegir la impresora de esta ventana (una sola vez) ---
echo.
echo  PASO 1 de 2: ELEGIR IMPRESORA
echo  Se abre una ventana de Chrome con una prueba de impresion.
echo  En "Destino" elige %IMPRESORA% y pulsa Imprimir.
echo  Chrome la recordara para "%NOMBRE%".
echo  Cuando salga el papel, CIERRA esa ventana para seguir.
echo.
pause
rem Espera aqui hasta que se cierre la ventana de prueba.
"%CHROME%" --user-data-dir="%NONNO_PERFIL%" --no-first-run --app="file:///%AQUI:\=/%prueba-impresora.html#%ROL%"

rem --- Paso 2: icono con impresion silenciosa ---
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\'+$env:NONNO_NOMBRE+'.lnk'); $s.TargetPath=$env:NONNO_CHROME; $s.Arguments='--user-data-dir='+[char]34+$env:NONNO_PERFIL+[char]34+' --kiosk-printing --no-first-run '+$env:NONNO_EXTRA+' --app='+$env:NONNO_URL; $s.IconLocation=$env:NONNO_CHROME+',0'; $s.Save()"

if /i "%ROL%"=="cocina" (
  rem La de cocina arranca sola al encender el ordenador.
  powershell -NoProfile -Command "Copy-Item ([Environment]::GetFolderPath('Desktop')+'\'+$env:NONNO_NOMBRE+'.lnk') ([Environment]::GetFolderPath('Startup')) -Force"
)

echo.
echo  PASO 2 de 2: LISTO. Tienes en el escritorio el icono "%NOMBRE%".
if /i "%ROL%"=="cocina" echo  Ademas se abrira sola al encender el ordenador.
echo.
echo  Ahora:
echo    1. Abre "%NOMBRE%" e inicia sesion en el panel ^(solo la primera vez^).
if /i "%ROL%"=="cocina" (
  echo    2. Ya esta: cada pedido nuevo saca sus comandas solo.
) else (
  echo    2. Ya esta: cada pedido de la web o del telefono saca el ticket del cliente solo.
)
echo    3. Dejala abierta ^(puede estar minimizada^).
if /i "%ROL%"=="cocina" (
  echo.
  echo  Si aun no has montado el TPV, vuelve a abrir este instalador y elige 2.
)
echo.
pause
