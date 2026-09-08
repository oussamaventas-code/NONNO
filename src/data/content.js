import { PHOTO } from './images'

/* ═══════════════════════════════════════════════════════════════
   CONTENIDO EDITORIAL
   Copy y estructura de las secciones narrativas. Separado de los
   componentes para poder reescribir la web sin tocar código.
   ═══════════════════════════════════════════════════════════════ */

/* ── HERO ─────────────────────────────────────────────────────── */
export const HERO = {
  image: PHOTO.heroPizza,
  alt: 'Porciones de pizza artesanal recién salidas del horno sobre madera oscura',
  line1: 'LA PIZZA',
  line2: 'NO SE EXPLICA.',
  line3Pre: 'SE ',
  line3Serif: 'MUERDE', // Cormorant Garamond italic
  line3Post: '.',
  sub: 'Pizza artesanal. Masa. Fuego. Ingredientes que hablan por sí solos.',
  ctaPrimary: 'PEDIR UNA PIZZA',
  ctaSecondary: 'VER EL MENÚ',
  badges: ['Pizza artesanal', 'Recogida', 'Entrega'],
  oven: {
    title: 'NONNO / ESTADO DEL HORNO',
    state: 'HORNO ENCENDIDO',
    line: 'HOY / PIZZA ARTESANAL',
  },
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
  { icon: 'pizza', text: 'Una Margherita acaba de salir del horno.' },
  { icon: 'flame', text: 'Pedido preparado.' },
  { icon: 'cheese', text: 'Extra mozzarella añadido.' },
  { icon: 'box', text: 'Pedido listo para recoger.' },
  { icon: 'flame', text: 'Horno a temperatura.' },
  { icon: 'pizza', text: 'Diavola en camino a la mesa 4.' },
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
