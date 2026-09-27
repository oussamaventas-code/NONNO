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

**Si el móvil está apagado o sin cobertura**, el pedido entra igual: solo no sale el SMS. En el panel aparece "No salió el SMS" con un botón para **reintentar**; si no, se llama al cliente. Sin estas variables configuradas, la web funciona igual pero no manda SMS.

---

## Pantalla de pedidos en la TV del local

Para que quien espera vea cómo va su pedido: **En preparación** y **¡Listo! Recoge tu pedido**, con el número y el nombre abreviado. Solo aparecen los pedidos para recoger; nunca teléfonos ni direcciones.

1. En la TV (o un ordenador/Chromecast/Fire TV conectado a ella) abre `tu-dominio/pantalla/sangonera` (o `/pantalla/santo-angel`).
2. Entra con la contraseña del local. Se queda guardada 30 días.
3. Pulsa **Pantalla completa y sonido** una vez: activa el aviso sonoro cuando un pedido pasa a listo.

Los pedidos pasan a "¡Listo!" cuando cocina pulsa **MARCAR LISTO** en el panel, y desaparecen al marcarlos **ENTREGADO**. Si se corta internet, la TV sigue enseñando lo último que sabía y se pone al día sola al volver.

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

## Ficheros

| Fichero | Qué hace |
|---|---|
| `supabase/schema.sql` | tabla de pedidos y de avisos |
| `api/orders.js` | crear pedido (público) y listarlos (panel) |
| `api/orders/[id].js` | cambiar estado, marcar impreso |
| `api/session.js` | entrar y salir del panel |
| `api/push.js` | alta y baja de avisos |
| `api/_lib/order.js` | saneado y recálculo de importes |
| `api/_lib/auth.js` | sesión firmada del panel |
| `src/admin/` | el panel de cocina |
| `public/sw.js` | recibe los avisos con el panel cerrado |
