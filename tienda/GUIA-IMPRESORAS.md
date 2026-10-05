# Instalar la impresión automática de Nonno

## Qué hace

El programa **Nonno Impresora** queda funcionando en el ordenador del local y envía automáticamente cada pedido nuevo a las impresoras configuradas:

- **Cocina:** una comanda por cada sección que tenga el pedido: ENTRANTES, PIZZAS · HORNO y BEBIDAS.
- **Mostrador:** el ticket completo del cliente. Los pedidos creados en el mostrador imprimen el ticket al cobrarlos.

Si el ordenador se desconecta, los trabajos quedan en cola y se intentan imprimir al volver la conexión. Si se pierde la confirmación después de salir el papel, el agente guarda localmente su identificador y reenvía la confirmación sin repetir la impresión. Al editar o cancelar un pedido, se retira de la cola su comanda anterior; si cocina ya podía haberla recibido, sale un aviso de modificación o cancelación. El panel de Nonno muestra el estado de las impresoras y permite enviar una prueba o reintentar trabajos fallidos.

## Antes de ir al local

La web debe estar desplegada y conectada a Supabase. Configura una sola vez:

1. En Supabase → **SQL Editor**, ejecuta [`../supabase/impresora.sql`](../supabase/impresora.sql).
2. En Vercel → **Environment Variables**, añade `PRINT_AGENT_SECRET` con un valor secreto aleatorio largo y redepliega la web.
3. Comprueba que las dos sedes existen en `store_status` (se crean con el esquema principal de Supabase).

## Instalar en el ordenador del local

Hace falta un ordenador Windows con internet y una impresora térmica de tickets ESC/POS para cocina y otra para mostrador. Se puede conectar por USB o por red TCP/IP (puerto 9100).

> Este instalador sirve para impresoras térmicas de tickets. No sirve para impresoras Zebra de etiquetas adhesivas.

1. Descarga `nonno-impresora.zip` desde **Configuración → Impresoras** del panel, o copia la carpeta `tienda/nonno-impresora` al ordenador del local, y descomprímela.
2. En el panel, abre **Reparto/Mostrador → ⚙ → Impresoras** y pulsa **Código de instalación** para esa sede.
3. Ejecuta **`INSTALAR NONNO IMPRESORA.bat`**. Elige la sede y pega el código.
4. Elige la impresora de cocina y la de mostrador. Para una impresora de red, selecciona `R` e introduce su IP; se usa el puerto 9100 salvo que indiques otro como `192.168.1.50:9100`.
5. El instalador deja el agente configurado para arrancar al iniciar sesión en Windows. No cierres su tarea programada. Esta preparación se hace una vez por ordenador; desde entonces no hay que abrir la web ni pulsar nada para que salga cada pedido.

## Comprobar que funciona

1. En el panel, comprueba que Nonno Impresora aparece **Conectada**.
2. Desde ⚙ → **Impresoras**, manda una prueba a Cocina y otra a Mostrador.
3. Haz un pedido de prueba con un entrante, una pizza y una bebida. Cocina debe recibir solo las secciones que incluya el pedido; el mostrador debe recibir el ticket completo.
4. Cancela el pedido de prueba.

## Si algo falla

| Problema | Qué revisar |
|---|---|
| El instalador dice que el código no es válido | Genera un código nuevo para la misma sede desde el panel. |
| El panel dice «Sin conexión» | Comprueba que el ordenador está encendido y conectado a internet; vuelve a ejecutar el instalador si hace falta. |
| Falta la tabla de impresión | Ejecuta `supabase/impresora.sql` en Supabase. |
| La impresora no aparece en Windows | Instala su controlador o conéctala a la red; para TCP/IP confirma su IP y el puerto RAW 9100. |
| El trabajo falla o no sale papel | Comprueba papel, conexión y que la impresora elegida corresponde a ese puesto; después pulsa **Reintentar** en el panel. |
| Sigue sin imprimir | Usa **Imprimir aquí** en el aviso del panel como alternativa temporal y revisa el registro en `%LOCALAPPDATA%\Nonno\impresora\registro.txt`. |

La carpeta `tienda` conserva `instalar-equipo-nonno.bat` como método anterior de impresión desde Chrome. Para instalaciones nuevas, usa el agente descrito en esta guía.
