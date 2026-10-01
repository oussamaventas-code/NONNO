# Montar las impresoras en la tienda (sin ayuda)

## Cómo es cada sede

- **Un solo ordenador: el TPV** (Windows, el de Repsol, el que tiene pídeme.net).
- **Dos impresoras**, que ya funcionan con el TPV por Wi-Fi o por cable:
  - **Cocina**: saca las comandas.
  - **Mostrador**: saca el ticket del cliente.

En el TPV se abren **dos ventanas de Nonno**, y cada una imprime en su impresora:

| Icono | Qué hace | Impresora |
|---|---|---|
| **Nonno Cocina** | Cuando entra un pedido (web, mostrador o teléfono), saca **sola** una etiqueta por sección: ENTRANTES, PIZZAS y BEBIDAS. Puede estar **minimizada**. | Cocina |
| **Nonno TPV** | La que usáis para tomar pedidos y cobrar. Al cobrar saca el **ticket con logo**. | Mostrador |

Cada icono es un Chrome aparte que **recuerda su impresora**, así que no se mezclan.

---

## 1. Comprobar que Windows ve las dos impresoras

En el TPV ve a *Configuración → Bluetooth y dispositivos → Impresoras y escáneres*.

- **Si aparecen las dos** (la de cocina y la del mostrador), apunta sus nombres y pasa al paso 2.
- **Si falta alguna**, puede que pídeme.net imprima directo, sin pasar por Windows. Para añadirla:
  1. Imprime la **hoja de configuración** de esa impresora. Suele salir dejando pulsado el botón FEED unos segundos con la tapa cerrada. Ahí viene su **IP**, algo como `192.168.1.50`.
  2. Descarga el **driver de la marca** desde su web oficial (Epson, Star, Bixolon, Xprinter…). La marca y el modelo están en la pegatina de la impresora.
  3. Instálalo y, cuando pida el puerto, elige **red / TCP/IP** con esa IP. Si no lo pide, ve a *Impresoras y escáneres → Agregar dispositivo → Agregar manualmente → Agregar con dirección TCP/IP*.
  4. Pulsa **Imprimir página de prueba**.

> **No cambies la impresora predeterminada ni toques la configuración de pídeme.net.** Así sigue funcionando todo como hasta ahora.

## 2. Montar "Nonno Cocina"

1. Copia la carpeta `tienda` al TPV (con un USB o descargándola de GitHub).
2. Doble clic en **`instalar-equipo-nonno.bat`**.
3. Escribe **1** (Cocina) y pega la dirección del panel de esa sede, por ejemplo `https://TU-WEB/admin/sangonera`.
4. Se abre una **prueba de impresión**:
   - En *Destino*, elige **la impresora de COCINA**. Si no está en la lista, pulsa *Ver más…*
   - Pulsa **Imprimir**.
   - Cuando salga el papel, **cierra esa ventana**.
5. Aparece en el escritorio el icono **"Nonno Cocina"**. Ábrelo, **inicia sesión**, ve a la pestaña **Cocina** y en el menú pon **Comandas automáticas: SÍ**.
6. Puedes minimizarla, pero **no la cierres**. Se abre sola cada vez que se enciende el ordenador.

## 3. Montar "Nonno TPV"

1. Vuelve a abrir **`instalar-equipo-nonno.bat`** y escribe **2** (TPV).
2. En la prueba de impresión, elige **la impresora del MOSTRADOR** y pulsa Imprimir.
3. Abre el icono **"Nonno TPV"**, inicia sesión y ve a la pestaña **Mostrador**.

## 4. Prueba final

1. Haz un pedido de prueba desde el móvil con entrante, pizza y bebida.
2. En **cocina** tienen que salir solas **3 etiquetas**: ENTRANTES, PIZZAS · HORNO y BEBIDAS.
3. En **Nonno TPV**, cobra el pedido marcando imprimir. En el **mostrador** sale el ticket con logo.
4. Cancela el pedido de prueba.

---

## Si algo falla

| Pasa esto | Haz esto |
|---|---|
| La comanda sale en el mostrador (o al revés) | Has elegido la impresora equivocada en la prueba. Vuelve a abrir el instalador para ese icono y elige la buena. |
| En cocina no sale nada | ¿Está abierta **Nonno Cocina** (aunque sea minimizada), en la pestaña **Cocina** y con **Comandas automáticas: SÍ**? ¿La impresora tiene papel? |
| Sale la ventana de "Imprimir" | Has abierto el panel desde el Chrome normal. Ábrelo desde los iconos **Nonno Cocina** o **Nonno TPV**. |
| Antes iba y ya no | La impresora ha cambiado de IP (pasa si se reinicia el router). Imprime su hoja de configuración y compara la IP. Lo mejor es pedir a quien os puso el router que **reserve la IP** de cada impresora. |
| Sale girado o en 2 trozos | En *Preferencias de impresión* de esa impresora: **Vertical** y el tamaño de papel correcto (rollo de 80 mm). |
| Pedidos que entraron con Nonno Cocina cerrada | No se imprimen solos. En la ventana **Nonno Cocina** (no en la del TPV, que imprime en el mostrador), abre el pedido y pulsa **IMPRIMIR COMANDA**. |
