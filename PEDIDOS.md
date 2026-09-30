# Sistema de pedidos — puesta en marcha

Cinco pasos. Unos 15 minutos. Hasta terminarlos, la web muestra "el sistema de pedidos todavía no está conectado" en lugar de aceptar pedidos.

---

## 1. Crear el proyecto en Supabase

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta.
2. **New project**. Ponle el nombre que quieras y elige la región **West EU (Ireland)** o **Frankfurt**, que son las más cercanas.
3. Guarda la contraseña de la base de datos que te genera (no se usa aquí, pero no la pierdas).

## 2. Crear la tabla de pedidos

En el proyecto, ve a **SQL Editor** → **New query**, pega el contenido completo de [`supabase/schema.sql`](supabase/schema.sql) y pulsa **Run**.

Debe decir *Success*. Puedes ejecutarlo más de una vez sin romper nada.

## 3. Copiar las claves

En Supabase, **Project Settings** → **API**. Necesitas dos valores:

| Dónde lo ves en Supabase | Para qué |
|---|---|
| **Project URL** | dirección de la base de datos |
| **service_role** (en Project API keys, hay que revelarla) | permite escribir pedidos desde el servidor |

La clave `service_role` es **secreta**. Solo va en las variables de Vercel, nunca en el código ni en el navegador. La tabla tiene la seguridad por filas activada y sin permisos públicos, así que la clave `anon` no sirve para leer pedidos aunque alguien la consiga.

## 4. Configurar Vercel

En tu proyecto de Vercel: **Settings** → **Environment Variables**.

| Nombre | Valor |
|---|---|
| `SUPABASE_URL` | el Project URL del paso 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | la clave service_role del paso 3 |
| `ADMIN_SESSION_SECRET` | cualquier texto largo y aleatorio (firma la sesión) |
| `ADMIN_PASSWORD_SANGONERA` | contraseña del local de Sangonera la Verde |
| `ADMIN_PASSWORD_SANTO_ANGEL` | contraseña del local de Santo Ángel |
| `ADMIN_PASSWORD` | contraseña de dirección: ve las dos sedes |

**Cada local tiene su contraseña y solo ve sus pedidos.** Quien entra con la de Sangonera no puede ver Santo Ángel, ni cambiando la dirección del navegador: el filtro se aplica en el servidor según con qué clave se entró, no según lo que pida el navegador.

Las tres contraseñas son independientes: pon solo las que necesites. Si únicamente configuras `ADMIN_PASSWORD`, esa clave verá las dos sedes.

Marca las tres opciones (Production, Preview, Development) en cada una.

Después, **Deployments** → botón derecho en el último → **Redeploy**. Las variables solo se aplican en un despliegue nuevo.

## 5. Comprobar que funciona

1. Entra en `tu-dominio.vercel.app/admin` y accede con la contraseña de una sede.
   Cada local tiene además su enlace propio: `/admin/sangonera` y
   `/admin/santo-angel`, para guardarlo en favoritos sin confundirse.
2. En otra pestaña, haz un pedido de prueba en la web.
3. El pedido debe aparecer en el panel en menos de 10 segundos, con aviso sonoro.
4. Pulsa **Imprimir** para ver el ticket.

---

## Avisos con el panel cerrado (opcional)

Si quieres que salte la notificación aunque el panel no esté abierto:

```bash
npx web-push generate-vapid-keys
```

Añade en Vercel `VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY` con los dos valores que salen, más `VAPID_SUBJECT` con `mailto:` y un correo de contacto. Vuelve a desplegar.

Después, en el panel aparece el botón **Activar avisos**. Hay que pulsarlo una vez en cada ordenador y aceptar el permiso del navegador.

Dos condiciones importantes:

- El navegador tiene que seguir vivo en segundo plano. Si se cierra Chrome del todo, no llega nada.
- En iPhone o iPad solo funciona si antes añaden la web a la pantalla de inicio. Es una restricción de Apple.

Con el panel abierto en el ordenador del local, el aviso sonoro ya cubre el caso normal; el push es el refuerzo.

---

## SMS al cliente (gratis, desde un Android del local)

El cliente recibe un SMS al confirmar el pedido (con la hora), otro cuando cocina lo marca **listo** (o "sale ya" si es a domicilio) y otro si se **cancela**. A quien pide en el mostrador solo le llega el de "listo".

Los SMS salen desde un móvil Android del local con su propia tarifa: si la tarifa incluye SMS, no cuesta nada.

1. En el móvil Android, instala **SMS Gateway for Android** (gratuita y de código abierto, [sms-gate.app](https://sms-gate.app)).
2. Ábrela, activa **Cloud server** y pulsa **Online**. La app muestra un **usuario** y una **contraseña**.
3. En Vercel → **Environment Variables**, añade `SMS_GATEWAY_USER` y `SMS_GATEWAY_PASSWORD` con esos dos valores. Vuelve a desplegar.
4. Haz un pedido de prueba con tu móvil: debe llegarte el SMS en unos segundos.

Para que no falle durante el servicio:

- El móvil tiene que estar **encendido, cargando y con cobertura o wifi**.
- En Ajustes → Batería, quita la **optimización de batería** a la app, o Android la dormirá.

**Sin Android: Twilio (de pago).** Si en Vercel están `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` y `TWILIO_FROM` (número de Twilio o remitente `NONNO`), los SMS salen por Twilio en vez de por el móvil. Unos 0,09 $ por SMS en España. La cuenta de prueba de Twilio solo envía a números verificados en su panel.

**Probar:** en el panel, menú ⚙ → "Probar los SMS a clientes": escribe tu móvil y pulsa Enviar.

**Si el móvil está apagado o sin cobertura**, el pedido entra igual: solo no sale el SMS. En el panel aparece "No salió el SMS" con un botón para **reintentar**; si no, se llama al cliente. Sin estas variables configuradas, la web funciona igual pero no manda SMS.

---

## Facturación (pestaña "Facturación" del panel, solo dirección)

Solo aparece con la contraseña que ve las dos sedes (`ADMIN_PASSWORD`); las contraseñas de un solo local (`ADMIN_PASSWORD_SANGONERA`, `ADMIN_PASSWORD_SANTO_ANGEL`) no la ven, ni desde el servidor aunque se manipule la petición.

Es un informe calculado contra la base de datos (no los últimos pedidos cargados): elige **Hoy, Ayer, Esta semana, Este mes o un rango personalizado**, y con el filtro de sede de arriba (**Todas las sedes / Sangonera / Santo Ángel**) se puede ver junto o por separado.

Muestra:

- **Facturación, nº de pedidos y ticket medio.**
- **Cobrado** frente a **pendiente de cobro** (según el estado de pago de cada pedido).
- Gráfico simple **por día**.
- Desglose **por sede**, **recogida/entrega**, **de dónde viene el pedido** (web/mostrador/teléfono) y **forma de pago** (efectivo/tarjeta, solo lo ya cobrado).

"Facturación" cuenta todos los pedidos no cancelados del rango, se hayan cobrado ya o no — igual que el aviso rápido de "hoy" que ya había en la cabecera del panel, que sigue ahí para un vistazo rápido sin entrar en la pestaña.

---

## Club Nonno (cuentas de cliente y puntos)

El cliente entra en **Mi cuenta** con su móvil y un código de 6 cifras que le llega por SMS, sin contraseñas. Dentro ve sus puntos, sus pedidos y el tique de cada uno para imprimir o guardar en PDF.

- **Gana 1 punto por cada euro** del total, cuando el pedido se marca **ENTREGADO** en el panel. Si el pedido lo hizo sin entrar en su cuenta, los puntos van igual al móvil del pedido, si ese móvil ya tiene cuenta.
- **100 puntos = 5 € de descuento** en un pedido online. Lo elige en el resumen del pedido. El descuento nunca cubre el envío.
- **Si se cancela un pedido**, se le devuelven los puntos que usó y se le quitan los que hubiera ganado con él.
- En el panel y en el tique de cocina sale la línea *Puntos Club Nonno (−X €)*, para cobrar lo correcto.

Las reglas están en `src/data/loyalty.js`. Si cambias ahí el reparto de puntos, cambia en toda la web y en el servidor a la vez.

**Para activarlo:**

1. En Supabase → **SQL Editor**, pega el contenido de [`supabase/club-nonno.sql`](supabase/club-nonno.sql) y pulsa **Run**. Va **después** de `schema.sql` y también se puede ejecutar varias veces.
2. En Vercel → **Environment Variables**, añade `CUSTOMER_SESSION_SECRET` con una frase larga al azar (como `ADMIN_SESSION_SECRET`). Si no la pones, se usa la del panel.
3. Los códigos salen por la misma pasarela de SMS que los avisos de pedido (ver arriba). **Sin la pasarela configurada, en la web publicada no se puede entrar**. En entornos de prueba de Vercel el código aparece en pantalla.
4. Vuelve a desplegar.

Mientras no se ejecute el SQL, la web funciona exactamente igual: **Mi cuenta** muestra "Muy pronto".

**Límites contra abusos:** un SMS por minuto y 5 por hora a cada móvil; cada código caduca a los 10 minutos y admite 5 intentos. La tabla guarda solo una huella del código, nunca el código.

**Facturas:** el tique sale como *Justificante de pedido*. Para que salga como **factura simplificada**, con la base imponible y el IVA desglosados, rellena la razón social y el NIF en `src/data/site.js` → `billing`.

**Ajustar puntos a mano** (un regalo, una reclamación): en Supabase → SQL Editor:

```sql
select loyalty_move(
  (select id from customers where phone = '+34600000000'),
  null, 50, 'ajuste', 'Regalo por la espera'
);
```

---

## Carta (pestaña "Carta" del panel)

Cambia la carta sin tocar código:

- **Precios** (solo dirección): escribe el precio nuevo y pulsa Intro. Vale para las dos sedes. Si lo dejas vacío, vuelve el precio de siempre. Los productos con ración y media ración tienen un precio para cada una.
- **Ocultar** (solo dirección): quita el producto de la web en todas las sedes. Sigue ahí para volver a mostrarlo.
- **Marcar agotado** (cada local el suyo): en la web sale "Agotado hoy" y no se puede añadir. El mostrador sí puede seguir vendiéndolo. Hay que quitarlo a mano al reponer.

- **Ingredientes** (cada local el suyo): en la pestaña *Ingredientes* de la Carta, marca **Sin stock** en lo que se ha acabado (por ejemplo, el jamón cocido). Las pizzas que lo llevan quedan **descartadas solas** en esa sede: la web pone "Sin jamón cocido", no deja añadirlas y el servidor las rechaza. El topping equivalente también sale tachado. En *Productos* ves cuáles se han descartado y por qué. Al reponer el ingrediente, vuelven solas. El mostrador sigue pudiendo venderlas.

La web lo recoge en menos de un minuto. El servidor aplica los precios nuevos al momento a cada pedido, así que un cliente con la web abierta desde antes nunca paga un precio viejo. Un producto agotado u oculto que ya estuviera en su carrito le sale como error al pedir, con el nombre del producto.

**Para activarlo** (una sola vez): en Supabase → SQL Editor → New query, pega el contenido de [`supabase/carta.sql`](supabase/carta.sql) y pulsa **Run**. Sin ese paso la pestaña avisa de que no puede guardar y la web sigue con la carta de siempre. Si ya lo ejecutaste antes de que existieran los ingredientes, **vuelve a ejecutarlo**: solo añade la tabla que falta y no toca lo que ya tienes.

## Descuentos (pestaña "Descuentos" del panel, solo dirección)

Rebaja el precio de **toda la carta, de unas categorías o de unos productos**, en **%** o en **€**. La web lo enseña tachando el precio de antes, y el mostrador y el servidor cobran el precio rebajado.

- Pulsa **Crear descuento**: nombre (lo ve el cliente), cuánto, a qué se aplica y cuándo (**desde ya** o **con fechas** de inicio y fin). Antes de guardar se ve cómo quedan los precios.
- Cada descuento se puede **apagar y encender** con un toque sin borrarlo.
- Si a un producto le tocan varios, se aplica el que más rebaja (no se suman). Los toppings no se rebajan. Las ofertas de recogida siguen funcionando: el cliente paga siempre lo más barato.
- La web lo recoge en menos de un minuto.

**Para activarlo** (una sola vez): en Supabase → SQL Editor → New query, pega [`supabase/descuentos.sql`](supabase/descuentos.sql) y pulsa **Run**. Sin ese paso la pestaña avisa y la carta sigue con sus precios.

## Crear pedidos: clientes que ya han pedido

En **Mostrador** y **Teléfono**, al escribir un teléfono de 9 cifras el panel busca a ese cliente entre los pedidos de la sede (no cuenta los cancelados; da igual cómo se escriba el número: con espacios, con +34…).

- Si ya ha pedido, rellena el nombre si estaba vacío y muestra su ficha: cuántos pedidos lleva y qué pidió la última vez.
- **Repetir último pedido** añade esas líneas al pedido, con sus extras y notas y a los precios de hoy. Los productos que ya no estén en la carta no se añaden y el panel lo avisa.
- **Usar su dirección** pone su última dirección de entrega y cambia el pedido a "Entrega".
- Cada local solo busca entre los pedidos de su sede; la dirección, en las dos. No hace falta crear nada en la base de datos. Si falla la búsqueda o no hay conexión, el pedido se toma igual.

## Reparto (pestaña "Reparto" del panel)

El panel agrupa solo los pedidos a domicilio en **salidas**: los que están listos a horas parecidas y cerca entre sí van juntos (máximo 4 paradas), en el orden de paradas más corto.

Para cada salida:

- **Google Maps**: abre la ruta ya trazada en el móvil del repartidor.
- **Hoja de ruta**: se imprime con direcciones, teléfonos y lo que hay que cobrar en cada casa. Sirve aunque el móvil se quede sin batería o sin cobertura.
- **Sale el reparto**: fija la salida (ya no se reorganiza), marca los pedidos como listos y manda al cliente el SMS de "sale ya".

En **En reparto** se marca cada parada como *Entregado · efectivo*, *Entregado · tarjeta* o *Entregado* si ya estaba pagado. Si se pulsó "Sale el reparto" por error, **Deshacer salida** la devuelve a "Por salir".

Los pedidos con la dirección sin verificar (el cliente eligió la distancia a mano) salen en una salida propia con aviso de llamar antes. Los ajustes (paradas por salida, minutos de margen, velocidad) están en `src/data/locations.js`, en `delivery.routing`.

---

## Pantalla de pedidos en la TV del local

Para que quien espera vea cómo va su pedido: **En preparación** y **¡Listo! Recoge tu pedido**, con el número y el nombre abreviado. Solo aparecen los pedidos para recoger; nunca teléfonos ni direcciones.

1. En la TV (o un ordenador/Chromecast/Fire TV conectado a ella) abre `tu-dominio/pantalla/sangonera` (o `/pantalla/santo-angel`).
2. Entra con la contraseña del local. Se queda guardada 7 días. Tras 5 contraseñas malas desde el mismo sitio, el acceso se bloquea 15 minutos.

**Seguridad (una sola vez):** en Supabase → SQL Editor, pega [`supabase/seguridad.sql`](supabase/seguridad.sql) y pulsa **Run**. Activa el límite de intentos del login, de los códigos del Club, de los SMS y de los pedidos de la web. Además, en Vercel crea `ADMIN_SESSION_SECRET` con una cadena larga y aleatoria (30+ caracteres). Para **cerrar todas las sesiones abiertas** (por ejemplo si se pierde un ordenador), cambia ese valor y vuelve a desplegar.
3. Pulsa **Pantalla completa y sonido** una vez: activa el aviso sonoro cuando un pedido pasa a listo.

Los pedidos pasan a "¡Listo!" cuando cocina pulsa **LISTO** en el panel, y desaparecen al marcarlos **ENTREGADO**. Si se corta internet, la TV sigue enseñando lo último que sabía y se pone al día sola al volver.

---

## Cómo funciona por dentro

```
Cliente confirma el pedido
        ↓
POST /api/orders          ← recalcula los importes, no se fía del navegador
        ↓
Tabla orders (Supabase)
        ↓
Panel /admin              ← consulta cada 8 s + aviso sonoro
        ↓
Imprimir ticket 80 mm
```

Estados de un pedido: `nuevo` → `horno` → `listo` → `entregado`. También se puede `cancelado`.

**El pago sigue siendo en persona.** La web no cobra nada; el ticket lo deja escrito.

## Avisos por WhatsApp (Twilio)

Si está configurado, el cliente recibe los avisos por **WhatsApp**. Si no tiene WhatsApp o el mensaje no llega, sale automáticamente el **SMS** de siempre (si hay SMS configurado). El panel dice por dónde salió cada aviso.

WhatsApp solo deja que el negocio escriba primero con **plantillas aprobadas por Meta**. Pasos (una sola vez):

1. **Número de WhatsApp del negocio.** En Twilio → *Messaging → Senders → WhatsApp senders* → registra un número (hace falta cuenta de pago y la cuenta de Facebook/Meta Business del negocio). Nombre visible: *La Pizza de Nonno*. El número de prueba `+49…` de Twilio no sirve para clientes.
2. **Crear las plantillas** en Twilio → *Messaging → Content Template Builder*. Idioma **Spanish (es)**, categoría **Utility**, tipo *Text*, y **Submit for WhatsApp approval**. Copia cada texto tal cual (`{{1}}`, `{{2}}`… son los huecos que rellena la web):

   | Nombre | Texto | Variable en Vercel |
   |---|---|---|
   | `nonno_pedido_recibido` | ¡Hola! Hemos recibido tu pedido *{{1}}* en La Pizza de Nonno. {{2}}. Total: {{3}}. Sigue tu pedido o contacta con nosotros: {{4}} ¡Gracias! | `TWILIO_WA_RECIBIDO` |
   | `nonno_pedido_listo` | ¡Tu pedido *{{1}}* ya está listo! Puedes recogerlo en La Pizza de Nonno {{2}}. ¡Te esperamos! | `TWILIO_WA_LISTO` |
   | `nonno_pedido_reparto` | Tu pedido *{{1}}* de La Pizza de Nonno ya va de camino. {{2}}. ¡Que aproveche! | `TWILIO_WA_REPARTO` |
   | `nonno_pedido_cancelado` | Tu pedido *{{1}}* de La Pizza de Nonno se ha cancelado. Si tienes cualquier duda, llámanos al {{2}}. Disculpa las molestias. | `TWILIO_WA_CANCELADO` |
   | `nonno_codigo` | tipo **Authentication** (el texto lo pone WhatsApp), con botón *Copy code* | `TWILIO_WA_CODIGO` |

   Ejemplos que pide Twilio para los huecos: `07` · `Recógelo en Sangonera la Verde a las 21:30` · `22,90 €` · `https://tu-dominio/p/07-a1b2c3d4e5` · `Llega hacia las 22:40` · `968 00 00 00`.
3. **Vercel → Environment Variables**: `TWILIO_WHATSAPP_FROM` (el número del paso 1, `+34…`) y, por cada plantilla **aprobada**, su identificador `HX…` en la variable de la tabla. Pon también `SITE_URL` (`https://tu-dominio`): con ella llega el enlace de seguimiento y Twilio puede avisar a la web cuando un WhatsApp no se entrega (entonces sale el SMS). **Redeploy**.
4. **Probar**: panel → ⚙ → "Probar los avisos a clientes".

Un aviso sin su plantilla configurada sale por SMS, así que se puede activar poco a poco. Precio: Meta cobra cada plantilla de categoría *Utility* más la comisión de Twilio (mira las tarifas de España en Twilio).

## Número de pedido del día

Cada sede numera sus pedidos **01, 02, 03…** y vuelve a empezar cada día (el día cambia a las 5 de la mañana, así lo pedido después de medianoche cuenta en la misma noche). Es el número que se dice al cliente y el que sale en el ticket y en el SMS.

**Para activarlo** (una sola vez): en Supabase → SQL Editor, pega [`supabase/numero-pedido.sql`](supabase/numero-pedido.sql) y pulsa **Run**. Sin ese paso los pedidos siguen entrando con la referencia de antes (`NN-4821`).

Los pedidos tomados en el mostrador sin conexión mantienen su referencia `SC-…`, la que ya salió impresa. En la factura simplificada el número lleva delante la fecha y la sede (`20260929-sangonera-07`) para que no se repita nunca.

## Ficheros

| Fichero | Qué hace |
|---|---|
| `supabase/schema.sql` | tabla de pedidos y de avisos |
| `supabase/numero-pedido.sql` | número de pedido del día (01, 02…) por sede |
| `supabase/club-nonno.sql` | clientes, códigos por SMS y puntos del Club Nonno |
| `api/account.js` | entrar con el móvil y datos de Mi cuenta |
| `api/_lib/customer.js` | sesión del cliente, códigos y movimientos de puntos |
| `src/data/loyalty.js` | reglas de los puntos |
| `api/orders.js` | crear pedido (público) y listarlos (panel) |
| `api/orders/[id].js` | cambiar estado, marcar impreso |
| `api/session.js` | entrar y salir del panel |
| `api/push.js` | alta y baja de avisos |
| `api/_lib/order.js` | saneado y recálculo de importes |
| `api/_lib/auth.js` | sesión firmada del panel |
| `src/admin/` | el panel de cocina |
| `public/sw.js` | recibe los avisos con el panel cerrado |
