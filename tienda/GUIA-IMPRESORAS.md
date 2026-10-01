# Montar las impresoras en la tienda (sin ayuda)

Cada sede tiene **dos ordenadores**, cada uno con **su impresora**:

| | COCINA | TPV / MOSTRADOR |
|---|---|---|
| Qué imprime | Etiquetas ENTRANTES / PIZZAS / BEBIDAS, **solas**, al entrar cada pedido | Ticket del cliente con logo, al cobrar |
| Pestaña del panel | **Cocina** | **Mostrador** |
| "Comandas automáticas" | **SÍ** | NO |

La web siempre imprime en la **impresora predeterminada** de ese ordenador. Si cada ordenador tiene la suya bien puesta, no hay más secreto.

---

## 1. Conectar la impresora Wi-Fi a la red

1. Enciende la impresora y conéctala al **Wi-Fi de la tienda**. Según el modelo, se hace desde su pantalla, con el botón **WPS** (pulsar WPS en el router y luego en la impresora) o con la app del fabricante.
2. Imprime la **hoja de configuración** de la impresora. Suele salir dejando pulsado el botón FEED unos segundos o desde su menú. En esa hoja viene su **dirección IP**, algo como `192.168.1.50`. Apúntala.
3. **Recomendable:** en el router, "reserva" esa IP para la impresora (DHCP estático). Si no, el día que el router se reinicie la impresora puede cambiar de dirección y dejar de imprimir.

## 2. Instalarla en el ordenador

1. Descarga el **driver de la marca** desde su web oficial (Epson, Star, Bixolon, Xprinter…). Busca el modelo y entra en *Drivers*.
2. Instálalo. Cuando pregunte el puerto o la conexión, elige **red / TCP/IP** y escribe la IP que apuntaste.
   - Si el instalador no lo pregunta, ve a *Configuración → Bluetooth y dispositivos → Impresoras y escáneres → Agregar dispositivo*. Si no aparece sola, pulsa *Agregar manualmente → Agregar con dirección TCP/IP* y escribe la IP.
3. Abre las **Preferencias de impresión** de la impresora:
   - Papel **80 mm** (rollo). Para etiquetas como la Zebra: 10 × 15 cm.
   - Orientación **Vertical**.
   - Si es térmica sin cinta: **Térmico directo**.
4. Pulsa **Imprimir página de prueba**. Si sale, está bien.
5. Ponla como **predeterminada**:
   - En *Impresoras y escáneres*, desactiva **"Permitir que Windows administre mi impresora predeterminada"**.
   - Entra en la impresora y pulsa **Establecer como predeterminada**.

## 3. El icono del panel (impresión sin ventanas)

1. Copia la carpeta `tienda` al ordenador (con un USB o descargándola de GitHub).
2. Doble clic en **`instalar-equipo-nonno.bat`**.
3. Elige **1 = Cocina** o **2 = TPV**.
4. Pega la dirección del panel de esa sede, por ejemplo `https://TU-WEB/admin/sangonera`.
5. Sale en el escritorio el icono **"Nonno Cocina"** o **"Nonno TPV"**. El de cocina, además, se abre solo al encender el ordenador.
6. Ábrelo, **inicia sesión** (solo la primera vez) y:
   - **Cocina:** pestaña **Cocina** → menú → **Comandas automáticas: SÍ**.
   - **TPV:** pestaña **Mostrador**.

Abriendo el panel desde ese icono, Chrome imprime **directo**, sin la ventana de "Imprimir".

## 4. Prueba final

1. Haz un pedido de prueba desde el móvil con entrante, pizza y bebida.
2. En **cocina** tienen que salir solas **3 etiquetas**: ENTRANTES, PIZZAS · HORNO y BEBIDAS.
3. En el **TPV**, cobra el pedido marcando imprimir. Sale el **ticket con logo**.
4. Cancela el pedido de prueba.

---

## Si algo falla

| Pasa esto | Haz esto |
|---|---|
| No imprime nada | ¿Impresora encendida y con papel? ¿Es la **predeterminada**? Imprime la página de prueba de Windows. |
| Antes iba y ya no | La impresora ha cambiado de IP. Imprime su hoja de configuración y comprueba la IP. Mejor: reserva la IP en el router (paso 1.3). |
| Sale la ventana de "Imprimir" | No has abierto el panel desde el icono **Nonno Cocina/TPV**. Ciérralo y ábrelo desde el icono. |
| En cocina no sale solo | Pestaña **Cocina** abierta, **Comandas automáticas: SÍ** y la ventana **sin minimizar**. |
| Sale girado o en 2 trozos | Preferencias de impresión → **Vertical** y el tamaño de papel correcto. |
| Salen la fecha y la web encima del ticket | En la ventana de imprimir de Chrome, quita **Encabezados y pies de página**. |
| Zebra en rojo, "Falta de cinta" | Preferencias → Configuración avanzada → **Térmico directo** → Calibrar. |
| Pedidos que entraron con el panel cerrado | No se imprimen solos. Ábrelos en el panel y pulsa **IMPRIMIR COMANDA**. |
