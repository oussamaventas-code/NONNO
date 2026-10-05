# NONNO — cambios y puesta en marcha

**Fecha:** 5 de octubre de 2026

**Estado:** cambios preparados en esta rama; la web no se ha desplegado.

## Añadido y terminado en el código

- **Impresión automática:** cola de comandas/tickets en Supabase, agente de Windows para impresoras térmicas ESC/POS, instalación por sede desde un código del panel y deduplicación/reintentos para evitar copias al recuperar la conexión. Al editar o cancelar un pedido se gestionan las comandas que aún están pendientes.
- **Avisos al cliente:** eventos de pedido recibido, listo para recoger, salida a reparto y cancelación; WhatsApp con plantillas de Twilio y fallback a SMS si Twilio rechaza la solicitud de WhatsApp; estado, reintento manual y prueba SMS desde el panel.
- **Mantenimiento:** registro mensual por sede con fecha, responsable, tareas, incidencias y estado realizado/previsto.
- **Mostrador y carta:** guía integrada para atender pedidos por teléfono y mejoras de textos, reglas del Club Nonno y avisos relacionados con alérgenos. Los datos de las sedes se conservaron como estaban.
- **Operación y presentación:** documentación actualizada para los nuevos flujos, protección de cabeceras web y correcciones de reintentos para que una respuesta perdida no deje sin recuperar la impresión automática.
- **Documentación:** puesta al día de `PEDIDOS.md`, guía de instalación de impresoras y este resumen.

## Cómo usarlo

### Instalar la impresora automática

1. Ejecuta `supabase/impresora.sql` en el SQL Editor del proyecto Supabase.
2. Configura `PRINT_AGENT_SECRET` como variable protegida de Vercel y despliega la web cuando se apruebe.
3. En el ordenador Windows del local, descarga `public/nonno-impresora.zip` o el ZIP desde **Configuración → Impresoras** del panel y descomprímelo.
4. En el panel, crea un código de instalación para la sede. Ejecuta `INSTALAR NONNO IMPRESORA.bat`, indica la sede, pega el código y selecciona las impresoras de cocina y mostrador.
5. Envía una prueba desde el panel. El ordenador, la sesión de Windows y las impresoras deben estar disponibles durante el servicio.

Las instrucciones completas están en `tienda/nonno-impresora/LEEME.txt` y `tienda/GUIA-IMPRESORAS.md`.

### Activar avisos al cliente

1. Ejecuta `supabase/notificaciones-cliente.sql` en Supabase.
2. En Vercel, configura credenciales protegidas para **SMS Gateway** (`SMS_GATEWAY_USER`, `SMS_GATEWAY_PASSWORD`) o **Twilio SMS** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`). Para WhatsApp, registra el remitente de Twilio y configura las plantillas aprobadas `TWILIO_WA_RECIBIDO`, `TWILIO_WA_LISTO`, `TWILIO_WA_REPARTO` y `TWILIO_WA_CANCELADO`.
3. Despliega tras la aprobación. Comprueba el estado en **Configuración → Avisos a clientes**. Desde ahí se puede enviar un SMS real de prueba (el proveedor puede cobrarlo) o reintentar los avisos fallidos.

Twilio aceptando el mensaje no confirma que el teléfono lo haya recibido. El fallback a SMS ocurre si la solicitud inicial de WhatsApp es rechazada.

### Registrar mantenimiento

1. Ejecuta `supabase/mantenimiento.sql` en Supabase.
2. Tras el despliegue, abre el panel y la pestaña **Mantenimiento** para añadir o editar los registros por sede y mes.

### Verificar cambios locales

Desde la carpeta del proyecto: `npm install` y `npm run dev`. La vista de carta local es `http://127.0.0.1:5173/carta`. La compilación de producción comprobada para esta rama es `npm run build`.

## Pendiente antes de usar en producción

- Aplicar las tres migraciones indicadas a la base de datos de producción y configurar las variables protegidas necesarias en Vercel; no se han tocado servicios externos.
- Instalar el agente en el equipo real de cada local y probar con sus impresoras, una comanda, ticket, reintento, edición y cancelación.
- Configurar y comprobar SMS/WhatsApp con credenciales reales. No se han enviado mensajes de prueba ni pedidos reales desde este trabajo.
- Confirmar con Nonno la matriz oficial de alérgenos y contaminación cruzada y revisar las fotos aprobadas de los productos. El código no inventa esos datos.
- Revisar los datos fiscales y las condiciones definitivas del Club Nonno que recoge el checklist del proyecto.

## Límites de esta entrega

La compilación local terminó correctamente. Los cambios aún no están desplegados y la prueba física de impresoras ni las pruebas reales de mensajería quedan verificadas hasta completar los pasos anteriores. No se han cambiado los datos actuales de las sedes.
