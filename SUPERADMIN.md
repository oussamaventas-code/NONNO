# Nonno Superadmin

El panel está en /superadmin y está pensado para usarse desde el móvil.

## Activación del acceso

1. En las variables privadas del proyecto en Vercel o Netlify, configura `SUPERADMIN_PASSWORD` con la clave de dirección elegida y `ADMIN_SESSION_SECRET` con una cadena aleatoria larga.
2. Conserva `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` como variables privadas del servidor. No añadas claves `service_role` a variables `VITE_*`.
3. En Supabase, ejecuta supabase/superadmin.sql y supabase/carta.sql. El primero crea el contenido del sitio y la biblioteca de imágenes; el segundo añade los cambios de ficha de producto.
4. Vuelve a desplegar la aplicación y abre /superadmin.

En Netlify, `netlify.toml` prepara la compilación de Vite, las rutas de la SPA, las cabeceras de seguridad y las funciones `/api/*`. La función programada `daily-close` conserva el recordatorio nocturno; configura también `CRON_SECRET` en las variables privadas del proyecto.

El navegador recibe una cookie de sesión HttpOnly, firmada y limitada al superadmin. La contraseña no está escrita en el código del cliente ni en este repositorio. Los intentos de entrada usan el límite ya existente en /api/session.

## Qué se puede editar

- Fotos de portada, sedes, historia y elaboración; foto individual de cada producto.
- Logo principal del sitio, navegación, paneles y ticket digital; icono de pestaña y de la app de clientes instalada en iPhone/Android. Los iconos de las apps internas de cocina y reparto se mantienen independientes.
- Nombre, categoría, descripción, ingredientes, precio, foto y visibilidad de los productos.
- Alérgenos generales y alérgenos confirmados para cada ficha.
- Dirección, horario, URL de Google Maps y coordenadas de las dos sedes.
- Datos legales y contacto de la página de privacidad.

Las fotos aceptan JPG, PNG, WebP, AVIF y HEIC/HEIF cuando el navegador del móvil puede convertirlas. Las imágenes grandes se optimizan en el dispositivo; la foto final ocupa como máximo 3 MB. Se guardan en el bucket público nonno-site-assets; no se envían a una cuenta personal.

## Pendiente antes de publicar la política legal

El responsable debe completar el nombre legal, domicilio de contacto, correo de privacidad, base del tratamiento, destinatarios/proveedores y plazos de conservación reales. La página muestra esos campos como pendientes y no inventa esos datos.
