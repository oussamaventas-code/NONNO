# Nonno Impresora · instalar en el local

Un programa del TPV que imprime solo las comandas y los tickets: sin Chrome abierto y sin ventanas de "Imprimir".
Funciona con impresoras de tickets (80 mm) **y con la Zebra de etiquetas 10×15**: cada una recibe el papel en su idioma.

## Ejemplo: Santo Ángel

| Impresora | Dónde está | Cómo va | Qué saca |
|---|---|---|---|
| La de cocina | Lejos, en cocina | Por la red (cable o WiFi, con IP) | Comandas: una por sección |
| Zebra GC420t | Junto al TPV | USB (driver ZDesigner) | Ticket del cliente con logo, en una etiqueta |

## Pasos (en el TPV)

1. **IP de la impresora de cocina**: imprime su hoja de configuración (normalmente dejando pulsado FEED unos segundos). Apunta la IP, p. ej. `192.168.1.50`.
   - Si en *Impresoras y escáneres* de Windows ya aparece la de cocina, también vale elegirla por su nombre.
2. **Código de instalación**: en el panel, ⚙ › Impresoras › "Código de instalación" de Santo Ángel. Cópialo.
3. Doble clic en **`INSTALAR NONNO IMPRESORA.bat`** y responde:
   - Local: **2** (Santo Ángel).
   - Código: pégalo (clic derecho).
   - **COCINA**: pulsa **R**, escribe la IP y a "¿Es una ZEBRA?" responde **N**.
     (Si sale en la lista con su nombre, puedes elegir su número.)
   - **MOSTRADOR**: elige el número de la Zebra (sale marcada como `ZEBRA`).
4. Al final pone `Cocina: ip:… (tickets)` y `Mostrador: ZDesigner… (Zebra, etiquetas)`. Listo.
5. En el panel, ⚙ › Impresoras: tienen que salir las dos como **conectada**. Pulsa **Imprimir prueba** en cada una.
   En la Zebra sale una etiqueta con el logo, "PRUEBA" y las tildes (áéíóú ñ €).

## Prueba final

Haz un pedido a domicilio de prueba (entrante, pizza y bebida):
- En **cocina**: una comanda por sección (ENTRANTES, PIZZAS · HORNO, BEBIDAS), con pitido y corte.
- En la **Zebra**: el ticket del cliente en una etiqueta, con el QR del repartidor al lado de la dirección.
- Cancélalo: en cocina sale el aviso **CANCELADO**.

## Si algo falla

| Pasa esto | Haz esto |
|---|---|
| La Zebra saca etiquetas en blanco o texto raro (`^XA…`) | En el instalador no se marcó como Zebra. Vuelve a abrirlo y elige la Zebra por su número (no con R). |
| La Zebra pone "Falta de cinta" o se salta etiquetas | Calíbrala: con la tapa cerrada, deja pulsado el botón hasta que parpadee 2 veces y suelta. Los papeles ya le dicen "térmico directo". |
| Cocina "no contesta en la red" | ¿Encendida y con cable? Si se reinició el router, puede haber cambiado de IP: mira la hoja de configuración y vuelve a instalar. Mejor reservar la IP en el router. |
| Un pedido largo sale en 2 etiquetas | Normal: la segunda pone "(sigue)". |
| El programa no da señal | Registro en `%LOCALAPPDATA%\Nonno\impresora\registro.txt`. Mientras tanto, en el aviso rojo del panel pulsa **Imprimir aquí** y lo pendiente sale por el navegador. |
