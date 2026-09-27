/* ═══════════════════════════════════════════════════════════════
   CONFIGURACIÓN GLOBAL DE MARCA Y SISTEMA
   Un único sitio donde tocar nombre, moneda, canales y textos SEO.
   ═══════════════════════════════════════════════════════════════ */

export const SITE = {
  brand: {
    line1: 'LA PIZZA DE',
    line2: 'NONNO', // se compone en serif italic en el logotipo
    claim: 'Pizza, fuego y muy buenas decisiones.',
    version: 'v1.0',
  },

  locale: 'es-ES',
  currency: 'EUR',

  seo: {
    title: 'La Pizza de Nonno | Pizza artesanal y pedidos online',
    description:
      'Pizza artesanal en Sangonera la Verde y Santo Angel. Masa, fuego e ingredientes de verdad. Elige tu sede, personaliza tu pizza y pide online.',
    // TODO: REEMPLAZAR CON EL DOMINIO REAL
    url: 'https://lapizzadenonno.example/',
  },

  /* ── CAPA DE INTEGRACIÓN DE PEDIDOS ────────────────────────────
     El adaptador se elige aquí; la implementación vive en
     src/lib/orderGateway.js

     'api'      → guarda el pedido en la base de datos y avisa al
                  panel de cocina (/admin). ES EL MODO ACTIVO.
     'whatsapp' → abre WhatsApp con el pedido formateado
     'external' → redirige a una plataforma externa (p. ej. pideme.net)
     'none'     → el pedido solo se compone, no se envía a ningún sitio

     El pago sigue siendo en persona: la web nunca cobra.
  */
  ordering: {
    adapter: 'api',
    apiEndpoint: '/api/orders',
    externalUrl: null,
    /* El coste de envío va por distancia: ver `delivery` en locations.js */
  },

  /* Estados de UI centralizados: mismo idioma en toda la web */
  messages: {
    cartEmpty: 'No hay pizza aquí todavía.',
    cartEmptyCta: 'VER EL MENÚ',
    added: (name) => `${name} añadida.`,
    error: 'No hemos podido actualizar tu pedido.',
    success: 'Perfecto. Ya está en tu pedido.',
    needLocation: '¿DESDE QUÉ NONNO PEDIMOS?',
    orderReady: 'Pedido listo para enviar.',
  },

  /* Claves de persistencia (versionadas por si cambia el esquema) */
  storage: {
    cart: 'nonno.cart.v1',
    location: 'nonno.location.v1',
    customer: 'nonno.customer.v1',
  },
}

/* Navegación principal (ids de sección para el scroll interno) */
export const NAV_LINKS = [
  { id: 'inicio', label: 'Inicio' },
  { id: 'menu', label: 'Menú' },
  { id: 'sedes', label: 'Nuestras sedes' },
  { id: 'experiencia', label: 'La experiencia' },
]
