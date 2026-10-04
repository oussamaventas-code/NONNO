import { PHOTO } from './images'

/* ═══════════════════════════════════════════════════════════════
   CONTENIDO EDITORIAL
   Copy y estructura de las secciones narrativas. Separado de los
   componentes para poder reescribir la web sin tocar código.
   ═══════════════════════════════════════════════════════════════ */

/* ── BARRA DE AVISO (arriba del todo) ─────────────────────────
   Sale de la oferta real de la carta (PICKUP_DEALS). */
export const ANNOUNCE = '¡2 pizzas clásicas por 19 € para recoger en tu sede!'

/* ── CINTA BAJO EL HERO ────────────────────────────────────────── */
export const TICKER = [
  'Masa de fermentación lenta',
  'Horno bien caliente',
  'Sangonera la Verde',
  'Santo Ángel',
  'Recogida y reparto a domicilio',
  'Pide online en un minuto',
]

/* Sello giratorio junto a la mascota */
export const STAMP_TEXT = 'RECIÉN HECHA · DESDE EL HORNO · '

/* ── OFERTAS DE RECOGIDA (sección propia en la landing) ─────── */
export const DEALS_BAND = {
  kicker: 'Solo para recoger en el local',
  title: 'Llévatelas por menos',
  note: 'El descuento se aplica solo al hacer el pedido. Los ingredientes extra se cobran aparte; clásicas y especiales no se mezclan en un mismo pack.',
}

/* ── HERO ─────────────────────────────────────────────────────── */
export const HERO = {
  line1: 'La pizza de siempre',
  line2: 'HECHA COMO EN CASA',
  tag: 'SANGONERA LA VERDE · SANTO ÁNGEL',
  sub: 'Masa de fermentación lenta, horno bien caliente e ingredientes de verdad. Elige tu sede, pide online y recógela recién hecha.',
  cta: 'Haz tu pedido',
  /* Columnas izquierda y derecha: vídeo corto en bucle con la foto
     como póster (su primer fotograma). Los originales en bruto están
     en videos-originales/, fuera de la web. */
  photoLeft: { video: '/videos/hero-izquierda.mp4', poster: '/videos/hero-izquierda.jpg', alt: 'Pizzas saliendo del horno en La Pizza de Nonno' },
  photoRight: { video: '/videos/hero-derecha.mp4', poster: '/videos/hero-derecha.jpg', alt: 'Porción de pizza levantándose con el queso estirándose' },
}

/* ── ILUSTRACIONES DE MARCA ────────────────────────────────────
   Se leen de public/ilustraciones/. Si el archivo aún no existe,
   la web muestra el logo en su lugar (nunca una imagen rota). */
export const ILLUSTRATIONS = {
  mascot: '/ilustraciones/nonno-mascota.png',      // hero, bajo el texto (original en ilustraciones-originales/)
  story: '/ilustraciones/nonno-historia.png',      // sección "Nuestra historia"
  delivery: '/ilustraciones/sticker-reparto.png',  // pegatina junto a las sedes
}

/* ── ESCAPARATE DE LA CARTA (landing) ─────────────────────────
   Tres pestañas; cada una junta categorías de la carta y enseña sus
   fotos en el carrusel. La carta completa vive en /carta. */
export const SHOWCASE_TABS = [
  {
    id: 'pizzas',
    label: 'PIZZAS',
    categories: ['pizzas-clasicas', 'pizzas-especiales'],
    text: [
      'Aquí no hay atajos: masa de fermentación lenta, horno bien caliente y los ingredientes justos para que cada pizza sepa a lo que tiene que saber.',
      'Las clásicas de toda la vida y las especiales de la casa, todas de 33 cm. Tú eliges la tuya; nosotros la hacemos al momento.',
    ],
  },
  {
    id: 'entrantes',
    label: 'ENTRANTES',
    categories: ['entrantes'],
    text: [
      'Para abrir boca mientras sale la pizza, o para compartir en el centro de la mesa.',
    ],
  },
  {
    id: 'postres',
    label: 'POSTRES',
    categories: ['calzones-dulces', 'nonnitos-dulces'],
    text: [
      'El final dulce: calzones y nonnitos recién horneados para los que siempre dejan hueco para el postre.',
    ],
  },
]

/* ── CARTA: texto que acompaña a cada categoría ─────────────── */
export const MENU_INTRO =
  'Tanto si eres de las clásicas como si te atreves con algo nuevo, aquí tienes toda la carta.'

export const CATEGORY_BLURBS = {
  'pizzas-clasicas': 'Las de toda la vida, las que nunca fallan. Masa fina, tomate, mozzarella y lo justo encima para que cada bocado sepa a lo que tiene que saber.',
  'pizzas-especiales': 'Para los que quieren algo más. Combinaciones de la casa con más ingredientes y más carácter, en la misma masa de siempre.',
  calzones: 'La pizza doblada sobre sí misma y cerrada en el horno. Todo el relleno dentro, caliente hasta el último bocado.',
  entrantes: 'Para abrir boca mientras sale la pizza, o para compartir en el centro de la mesa.',
  'calzones-dulces': 'El final dulce: masa horneada y rellena para los que siempre dejan hueco para el postre.',
  'nonnitos-dulces': 'Bocaditos de nuestra masa recién horneados y bañados en tu crema favorita. Para compartir (o no).',
  bebidas: 'Frías y listas para acompañar la pizza.',
}

/* ── NUESTRA HISTORIA ──────────────────────────────────────────
   TODO: SUSTITUIR POR LA HISTORIA REAL DE NONNO (quién lo fundó,
   cuándo y dónde). No se inventan fechas ni nombres. */
export const STORY = {
  title: 'Nuestra historia',
  lines: [
    'La masa, el horno y las ganas de hacerlo bien',
    'son los ingredientes que convierten a Nonno',
    'en la pizzería de tu barrio.',
  ],
}

/* ── VALORES: sellos que cambian el texto del recuadro ─────────── */
export const VALUES = [
  {
    id: 'masa',
    kicker: 'Una buena dosis de',
    title: 'Masa',
    text: 'Todo empieza en la masa. La dejamos reposar sin prisa para que salga ligera por dentro y crujiente por fuera, como tiene que ser. No hay atajos: si no ha fermentado, no entra en el horno.',
  },
  {
    id: 'horno',
    kicker: 'Mucho',
    title: 'Horno',
    text: 'Calor alto y contacto directo. La pizza se hace en minutos y sale con los bordes dorados y el queso en su punto. Por eso la pedimos al momento y la hacemos al momento.',
  },
  {
    id: 'barrio',
    kicker: 'Una pizca de',
    title: 'Barrio',
    text: 'Dos sedes, Sangonera la Verde y Santo Ángel, y la misma forma de hacer las cosas en las dos. Pizza para recoger o para que te la llevemos a casa, de las que se piden una y otra vez.',
  },
]

/* ── PEDIDOS / SEDES ───────────────────────────────────────────── */
export const ORDER_BAND = {
  title: 'Haz tu pedido en nuestra web y recógelo en tu sede, ¡te esperamos!',
  services: 'RECOGIDA & ENTREGA A DOMICILIO',
}

/* ── MÉTRICAS ──────────────────────────────────────────────────
   Las dos primeras son datos proporcionados (valoraciones mostradas).
   Las dos últimas son de marca, etiquetadas como tales. */
export const METRICS = [
  { id: 'sangonera', value: 4.9, suffix: '★', decimals: 1, label: 'VALORACIÓN EN SANGONERA', note: '179 reseñas' },
  { id: 'santo-angel', value: 5.0, suffix: '★', decimals: 1, label: 'VALORACIÓN EN SANTO ÁNGEL', note: '33 reseñas' },
  { id: 'sedes', value: 2, suffix: '', decimals: 0, label: 'SEDES', note: 'Murcia' },
  { id: 'ganas', value: null, display: '∞', label: 'GANAS DE PIZZA', note: 'Dato no científico' },
]

/* ── PROCESO ───────────────────────────────────────────────────── */
export const PROCESS = [
  { id: '01', title: 'ELIGE', text: 'Explora el menú y encuentra la tuya. O la de todos.' },
  { id: '02', title: 'PERSONALIZA', text: 'Tamaño, extras y esa nota que lo cambia todo.' },
  { id: '03', title: 'DISFRUTA', text: 'La recoges o te la llevamos. Lo demás es cosa tuya.' },
]

/* ── SECCIÓN EDITORIAL ─────────────────────────────────────────── */
export const EDITORIAL = {
  image: PHOTO.ovenFire,
  alt: 'Pizza dentro del horno de leña con las llamas al fondo',
  blockA: ['NO HACEMOS', 'PIZZA RÁPIDA.'],
  blockB: ['HACEMOS', 'PIZZA QUE', 'DESAPARECE', 'RÁPIDO.'],
  highlight: 'DESAPARECE', // serif italic + rojo tomate
}

/* ── EXPERIENCIA / CALIDAD ─────────────────────────────────────── */
export const EXPERIENCE = {
  title: ['MASA LENTA.', 'HORNO RÁPIDO.'],
  text: 'Fermentación sin prisa, horno a temperatura de verdad y una lista de ingredientes que cabe en una mano. No hay más truco.',
  pillars: [
    { id: 'masa', label: 'LA MASA', text: 'Fermentación lenta. Ligera por dentro, crujiente donde toca.', image: PHOTO.doughBread, alt: 'Masa de fermentación lenta y trigo' },
    { id: 'horno', label: 'EL HORNO', text: 'Calor alto y contacto directo. La pizza se hace en minutos.', image: PHOTO.ovenFire, alt: 'Horno de leña encendido con una pizza dentro' },
    { id: 'ingredientes', label: 'LOS INGREDIENTES', text: 'Pocos, buenos y reconocibles. Se nota en el primer bocado.', image: PHOTO.basil, alt: 'Albahaca fresca' },
  ],
}

/* ── MICRO-UI: NOTIFICACIONES DE COCINA ────────────────────────
   Simulación visual de marca. NO son pedidos reales en tiempo real. */
export const KITCHEN_FEED = [
  { icon: 'pizza', text: 'Una Margarita acaba de salir del horno.' },
  { icon: 'flame', text: 'Pedido preparado.' },
  { icon: 'cheese', text: 'Extra mozzarella añadido.' },
  { icon: 'box', text: 'Pedido listo para recoger.' },
  { icon: 'flame', text: 'Horno a temperatura.' },
  { icon: 'pizza', text: 'Una Carnívora sale para reparto.' },
]

/* ── MICRO-UI: MINI DASHBOARD (VISUAL EXPERIENCE) ──────────────
   Valores ilustrativos de marca, nunca métricas de negocio. */
export const KITCHEN_KPIS = [
  { id: 'masa', label: 'MASA', value: '100%', caption: 'ARTESANAL', arc: 100 },
  { id: 'horno', label: 'HORNO', value: 'ON', caption: 'ACTIVO', arc: 86 },
  { id: 'pizza', label: 'PIZZA', value: '∞', caption: 'AMOR', arc: 100 },
]

export const KITCHEN_RHYTHM = [
  { id: 'prep', label: 'PREPARACIÓN', level: 0.72 },
  { id: 'horno', label: 'HORNO', level: 0.94 },
  { id: 'servicio', label: 'SERVICIO', level: 0.81 },
]

/* ── MICRO-UI: ANTES / DESPUÉS ─────────────────────────────────── */
export const BEFORE_AFTER = {
  before: { emoji: '😐', title: 'ANTES DE NONNO.', text: 'Hambre.', image: PHOTO.flour, alt: 'Harina y espigas de trigo' },
  after: { emoji: '😍', title: 'DESPUÉS DE NONNO.', text: 'Problema resuelto.', image: PHOTO.slicePull, alt: 'Porción de pizza con queso fundido' },
}

/* ── CTA FINAL ─────────────────────────────────────────────────── */
export const FINAL_CTA = {
  line1: 'EL HAMBRE',
  line2: 'NO ESPERA.',
  serif: 'NONNO TAMPOCO.',
  cta: 'PEDIR AHORA',
  foot: 'ELIGE TU SEDE · ELIGE TU PIZZA · DISFRUTA',
}
