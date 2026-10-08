# NONNO — cambios y puesta en marcha

**Fecha:** 6 de octubre de 2026

**Estado:** cambios preparados en esta rama; la web no se ha desplegado.

## Añadido y terminado en el código

- **Impresión automática:** cola de comandas/tickets en Supabase, agente de Windows para impresoras térmicas ESC/POS, instalación por sede desde un código del panel y deduplicación/reintentos para evitar copias al recuperar la conexión. Al editar o cancelar un pedido se gestionan las comandas que aún están pendientes.
- **Avisos al cliente:** eventos de pedido recibido, listo para recoger, salida a reparto y cancelación; WhatsApp con plantillas de Twilio y fallback a SMS si Twilio rechaza la solicitud de WhatsApp; estado, reintento manual y prueba SMS desde el panel.
- **Mantenimiento:** registro mensual por sede con fecha, responsable, tareas, incidencias y estado realizado/previsto.
- **Fotos de carta:** 35 fotos con correspondencia clara con productos de `C:\Users\Ayoub\Desktop\Work\Webs\IMAGES` se integraron en WebP de 600 y 1200 px. Se ajustaron las tarjetas para mantener el encuadre sin estirar ni cortar las fotos y se corrigieron dos asociaciones de producto.
- **Mostrador y carta:** guía integrada para atender pedidos por teléfono y mejoras de textos, reglas del Club Nonno y avisos relacionados con alérgenos. Los datos de las sedes se conservaron como estaban.
- **Operación y presentación:** documentación actualizada para los nuevos flujos, protección de cabeceras web y correcciones de reintentos para que una respuesta perdida no deje sin recuperar la impresión automática.
- **Documentación:** puesta al día de `PEDIDOS.md`, guía de instalación de impresoras y este resumen.
- **Superadmin y páginas públicas:** panel móvil en `/superadmin` para imágenes, carta y precios, alérgenos, logos, sedes, privacidad e icono de la app; páginas de alérgenos y privacidad, cookies ilustradas como pizza y página visual de error 404.
- **Despliegue en Netlify:** compatibilidad para mantener las API existentes en `/api/*`, cabeceras de seguridad, rutas de la SPA y recordatorio programado de cierre; el proyecto anterior de Netlify es otra aplicación y se mantiene intacto.

## Cómo usarlo

### Instalar la impresora automática

1. Ejecuta `supabase/impresora.sql` en el SQL Editor del proyecto Supabase.
2. Configura `PRINT_AGENT_SECRET` como variable protegida de Vercel o Netlify y despliega la web cuando se apruebe.
3. En el ordenador Windows del local, descarga `public/nonno-impresora.zip` o el ZIP desde **Configuración → Impresoras** del panel y descomprímelo.
4. En el panel, crea un código de instalación para la sede. Ejecuta `INSTALAR NONNO IMPRESORA.bat`, indica la sede, pega el código y selecciona las impresoras de cocina y mostrador.
5. Envía una prueba desde el panel. El ordenador, la sesión de Windows y las impresoras deben estar disponibles durante el servicio.

Las instrucciones completas están en `tienda/nonno-impresora/LEEME.txt` y `tienda/GUIA-IMPRESORAS.md`.

### Actualizar las fotos de la carta

Los productos leen sus fotos desde `src/data/images.js`; los archivos propios se guardan en `public/fotos/pizzas/` como `nombre-600.webp` y `nombre-1200.webp`. Al cambiar una foto, conserva ambos tamaños y el identificador `own:nombre` para que carta, detalle y pedido usen la misma imagen optimizada. Las tarjetas mantienen la proporción y contienen la foto completa. Incrementa `OWN_REVISION` en `src/data/images.js` para que los navegadores carguen la versión nueva.

### Activar avisos al cliente

1. Ejecuta `supabase/notificaciones-cliente.sql` en Supabase.
2. En Vercel o Netlify, configura credenciales protegidas para **SMS Gateway** (`SMS_GATEWAY_USER`, `SMS_GATEWAY_PASSWORD`) o **Twilio SMS** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`). Para WhatsApp, registra el remitente de Twilio y configura las plantillas aprobadas `TWILIO_WA_RECIBIDO`, `TWILIO_WA_LISTO`, `TWILIO_WA_REPARTO` y `TWILIO_WA_CANCELADO`.
3. Despliega tras la aprobación. Comprueba el estado en **Configuración → Avisos a clientes**. Desde ahí se puede enviar un SMS real de prueba (el proveedor puede cobrarlo) o reintentar los avisos fallidos.

Twilio aceptando el mensaje no confirma que el teléfono lo haya recibido. El fallback a SMS ocurre si la solicitud inicial de WhatsApp es rechazada.

### Registrar mantenimiento

1. Ejecuta `supabase/mantenimiento.sql` en Supabase.
2. Tras el despliegue, abre el panel y la pestaña **Mantenimiento** para añadir o editar los registros por sede y mes.

### Acceder al Superadmin

Configura en las variables privadas de Vercel o Netlify `SUPERADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`. Ejecuta `supabase/superadmin.sql` y `supabase/carta.sql`; después inicia sesión en `/superadmin`. La guía completa está en `SUPERADMIN.md`.

### Verificar cambios locales

Desde la carpeta del proyecto: `npm install` y `npm run dev`. La vista de carta local es `http://127.0.0.1:5173/carta`. La compilación de producción comprobada para esta rama es `npm run build`.

## Pendiente antes de usar en producción

- Aplicar las migraciones indicadas a la base de datos de producción y configurar las variables protegidas necesarias en Netlify; el proyecto anterior de Netlify no se modificó.
- Instalar el agente en el equipo real de cada local y probar con sus impresoras, una comanda, ticket, reintento, edición y cancelación.
- Configurar y comprobar SMS/WhatsApp con credenciales reales. No se han enviado mensajes de prueba ni pedidos reales desde este trabajo.
- Confirmar con Nonno la matriz oficial de alérgenos y contaminación cruzada y revisar las fotos aprobadas de los productos. El código no inventa esos datos.
- La carpeta no trae una coincidencia clara para todos los productos ni para las fotos de los locales y secciones de marca; esas imágenes conservan su origen actual. Se dejaron sin asignar fotos duplicadas, la imagen vacía y la pizza de nombre desconocido cuando no podía verificarse el producto. Fanta y Zero tampoco se añadieron como opciones nuevas de bebida.
- Revisar los datos fiscales y las condiciones definitivas del Club Nonno que recoge el checklist del proyecto.

## Límites de esta entrega

La compilación local terminó correctamente. Los cambios aún no están desplegados y la prueba física de impresoras ni las pruebas reales de mensajería quedan verificadas hasta completar los pasos anteriores. No se han cambiado los datos actuales de las sedes.
