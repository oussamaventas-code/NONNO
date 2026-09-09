import { PHOTO } from './images'

/* ═══════════════════════════════════════════════════════════════
   MENÚ

   DATOS DEMO EDITABLES — NO SON EL MENÚ OFICIAL DE NONNO.
   Nombres, descripciones, ingredientes, tamaños y precios son una
   estructura de ejemplo realista para que la web funcione hoy.

   TODO: REEMPLAZAR POR MENÚ REAL (carta, alérgenos y precios oficiales).

   ESQUEMA DE PRODUCTO
   ───────────────────
   id           string    único
   category     string    id de CATEGORIES
   name         string
   description  string    una línea, tono de marca
   ingredients  string[]  el cliente puede QUITAR cualquiera de ellos
                          desde el modal, sin cambiar el precio ni el
                          nombre del producto
   image        string    id de PHOTO (src/data/images.js)
   price        number    precio único (un solo tamaño de pizza)
   extras       string[]  ids de EXTRAS permitidos en este producto
   badge        string    etiqueta editorial opcional
   popular      bool
   vegetarian   bool
   spicy        bool
   layout       string    variante editorial de card: tall | circle | wide
   ═══════════════════════════════════════════════════════════════ */

export const CATEGORIES = [
  { id: 'pizzas', label: 'PIZZAS', note: 'Masa de fermentación lenta' },
  { id: 'entrantes', label: 'ENTRANTES', note: 'Para abrir boca' },
  { id: 'bebidas', label: 'BEBIDAS', note: 'Frío contra el horno' },
  { id: 'postres', label: 'POSTRES', note: 'El final feliz' },
  { id: 'extras', label: 'EXTRAS', note: 'Sube el nivel' },
]

/* ── TAMAÑO ─────────────────────────────────────────────────────
   Un único tamaño de pizza. Se muestra como dato, no como elección. */
export const PIZZA_SIZE = { diameter: '33 cm' }

/* ── EXTRAS (personalización) ───────────────────────────────────
   TODO: CONFIRMAR EXTRAS Y PRECIOS OFICIALES. */
export const EXTRAS = [
  { id: 'mozzarella', label: 'Extra mozzarella', price: 1.5, group: 'Quesos' },
  { id: 'burrata', label: 'Burrata fresca', price: 2.5, group: 'Quesos' },
  { id: 'parmesano', label: 'Parmesano curado', price: 1.5, group: 'Quesos' },
  { id: 'prosciutto', label: 'Extra jamón', price: 2.0, group: 'Carnes' },
  { id: 'pepperoni', label: 'Extra pepperoni', price: 1.8, group: 'Carnes' },
  { id: 'champinon', label: 'Champiñón', price: 1.2, group: 'Verduras' },
  { id: 'rucula', label: 'Rúcula fresca', price: 1.0, group: 'Verduras' },
  { id: 'cebolla', label: 'Cebolla caramelizada', price: 1.0, group: 'Verduras' },
  { id: 'picante', label: 'Aceite picante', price: 0.5, group: 'Toques finales' },
  { id: 'albahaca', label: 'Albahaca fresca', price: 0.5, group: 'Toques finales' },
  { id: 'borde', label: 'Borde relleno de queso', price: 2.5, group: 'Masa' },
]

export const getExtra = (id) => EXTRAS.find((e) => e.id === id) || null

/* Extras ofrecidos por defecto en cualquier pizza */
const PIZZA_EXTRAS = [
  'mozzarella', 'burrata', 'parmesano', 'prosciutto', 'pepperoni',
  'champinon', 'rucula', 'cebolla', 'picante', 'albahaca', 'borde',
]

/* ── PRODUCTOS ──────────────────────────────────────────────────
   TODO: REEMPLAZAR POR MENÚ REAL. Precios de ejemplo en euros. */
export const PRODUCTS = [
  {
    id: 'margherita',
    category: 'pizzas',
    name: 'Margherita',
    description: 'La prueba de fuego. Si esta está bien, todo lo demás también.',
    ingredients: ['Tomate San Marzano', 'Mozzarella fior di latte', 'Albahaca', 'Aceite de oliva'],
    image: PHOTO.margherita,
    price: 9.5,
    extras: PIZZA_EXTRAS,
    popular: true,
    vegetarian: true,
    spicy: false,
    layout: 'tall',
  },
  {
    id: 'diavola',
    category: 'pizzas',
    name: 'Diavola',
    description: 'Pica lo justo para que te acuerdes de ella mañana.',
    ingredients: ['Tomate', 'Mozzarella', 'Pepperoni picante', 'Aceite de guindilla'],
    image: PHOTO.diavola,
    price: 11.5,
    extras: PIZZA_EXTRAS,
    popular: true,
    vegetarian: false,
    spicy: true,
    layout: 'circle',
  },
  {
    id: 'prosciutto',
    category: 'pizzas',
    name: 'Prosciutto',
    description: 'Jamón, rúcula y cero necesidad de explicarse.',
    ingredients: ['Tomate', 'Mozzarella', 'Jamón curado', 'Rúcula', 'Parmesano'],
    image: PHOTO.prosciutto,
    price: 12.5,
    extras: PIZZA_EXTRAS,
    popular: false,
    vegetarian: false,
    spicy: false,
    layout: 'wide',
  },
  {
    id: 'quattro-formaggi',
    category: 'pizzas',
    name: 'Quattro Formaggi',
    description: 'Cuatro quesos discutiendo. Gana tu paladar.',
    ingredients: ['Mozzarella', 'Gorgonzola', 'Parmesano', 'Provolone'],
    image: PHOTO.formaggi,
    price: 12.9,
    extras: PIZZA_EXTRAS,
    popular: true,
    vegetarian: true,
    spicy: false,
    layout: 'tall',
  },
  {
    id: 'vegetale',
    category: 'pizzas',
    name: 'Vegetale',
    description: 'Verdura de verdad, no de compromiso.',
    ingredients: ['Tomate', 'Mozzarella', 'Calabacín', 'Pimiento asado', 'Rúcula', 'Ricotta'],
    image: PHOTO.vegetale,
    price: 11.9,
    extras: PIZZA_EXTRAS,
    popular: false,
    vegetarian: true,
    spicy: false,
    layout: 'circle',
  },
  {
    id: 'funghi',
    category: 'pizzas',
    name: 'Funghi',
    description: 'Champiñón, ajo y esa cosa que hace el horno con las setas.',
    ingredients: ['Mozzarella', 'Champiñón', 'Ajo confitado', 'Tomillo'],
    image: PHOTO.funghi,
    price: 11.9,
    extras: PIZZA_EXTRAS,
    popular: false,
    vegetarian: true,
    spicy: false,
    layout: 'wide',
  },
  {
    id: 'bufala',
    category: 'pizzas',
    name: 'Bufala',
    description: 'Mozzarella de búfala. Se nota desde el primer bocado.',
    ingredients: ['Tomate', 'Mozzarella de búfala', 'Albahaca', 'Aceite de oliva virgen extra'],
    image: PHOTO.bufala,
    price: 13.5,
    extras: PIZZA_EXTRAS,
    popular: false,
    vegetarian: true,
    spicy: false,
    layout: 'tall',
  },
  {
    id: 'bianca',
    category: 'pizzas',
    name: 'Bianca',
    description: 'Sin tomate. Sin miedo.',
    ingredients: ['Crema de ricotta', 'Mozzarella', 'Ajo', 'Albahaca', 'Pimienta negra'],
    image: PHOTO.bianca,
    price: 12.5,
    extras: PIZZA_EXTRAS,
    popular: false,
    vegetarian: true,
    spicy: false,
    layout: 'circle',
  },
  {
    id: 'nonno-speciale',
    category: 'pizzas',
    name: 'Nonno Speciale',
    description:
      'La que pide el Nonno cuando nadie mira. Masa madre, doble curación y todo lo que sabemos hacer.',
    ingredients: [
      'Tomate San Marzano', 'Mozzarella fior di latte', 'Jamón curado',
      'Burrata', 'Albahaca fresca', 'Aceite de oliva virgen extra',
    ],
    image: PHOTO.speciale,
    price: 14.9,
    extras: PIZZA_EXTRAS,
    badge: 'FAVORITA',
    featured: true,
    popular: true,
    vegetarian: false,
    spicy: false,
    layout: 'wide',
  },

  {
    id: 'pan-de-ajo',
    category: 'entrantes',
    name: 'Pan de ajo del horno',
    description: 'Misma masa, mismo horno, cero excusas.',
    ingredients: ['Masa artesanal', 'Ajo', 'Perejil', 'Aceite de oliva'],
    image: PHOTO.panDeAjo,
    price: 4.9,
    extras: ['mozzarella', 'parmesano', 'picante'],
    vegetarian: true,
    layout: 'wide',
  },
  {
    id: 'ensalada-nonno',
    category: 'entrantes',
    name: 'Ensalada Nonno',
    description: 'Verde, fresca y sorprendentemente necesaria.',
    ingredients: ['Hoja verde', 'Tomate', 'Parmesano', 'Vinagreta de la casa'],
    image: PHOTO.ensalada,
    price: 6.5,
    extras: ['burrata', 'parmesano'],
    vegetarian: true,
    layout: 'tall',
  },
  {
    id: 'alitas',
    category: 'entrantes',
    name: 'Alitas al horno',
    description: 'Crujientes por fuera. Peligrosas por dentro.',
    ingredients: ['Alitas de pollo', 'Especias de la casa', 'Limón'],
    image: PHOTO.alitas,
    price: 7.9,
    extras: ['picante'],
    spicy: true,
    layout: 'circle',
  },
  {
    id: 'tabla-quesos',
    category: 'entrantes',
    name: 'Tabla de quesos',
    description: 'Para los que empiezan por el final.',
    ingredients: ['Selección de quesos', 'Pan del horno', 'Miel'],
    image: PHOTO.cheeses,
    price: 9.5,
    extras: ['burrata'],
    vegetarian: true,
    layout: 'wide',
  },

  {
    id: 'limonada',
    category: 'bebidas',
    name: 'Limonada de la casa',
    description: 'Ácida, fría y con muy buen criterio.',
    ingredients: ['Limón', 'Menta', 'Hielo'],
    image: PHOTO.limonada,
    price: 3.2,
    vegetarian: true,
    layout: 'circle',
  },
  {
    id: 'zumo-naranja',
    category: 'bebidas',
    name: 'Zumo de naranja',
    description: 'Naranja. Exprimida. Punto.',
    ingredients: ['Naranja natural'],
    image: PHOTO.zumo,
    price: 3.5,
    vegetarian: true,
    layout: 'tall',
  },
  {
    id: 'vino-casa',
    category: 'bebidas',
    name: 'Vino de la casa',
    description: 'Tinto que entiende de pizza.',
    ingredients: ['Copa 15 cl'],
    image: PHOTO.vino,
    price: 3.9,
    vegetarian: true,
    layout: 'wide',
  },
  {
    id: 'cafe',
    category: 'bebidas',
    name: 'Café',
    description: 'El punto final de cualquier mesa italiana.',
    ingredients: ['Café de tueste natural'],
    image: PHOTO.cafe,
    price: 1.8,
    vegetarian: true,
    layout: 'circle',
  },

  {
    id: 'tarta-nonna',
    category: 'postres',
    name: 'Tarta de la Nonna',
    description: 'Chocolate serio. Nada de adornos.',
    ingredients: ['Chocolate negro', 'Mantequilla', 'Cacao'],
    image: PHOTO.tarta,
    price: 5.5,
    vegetarian: true,
    popular: true,
    layout: 'tall',
  },
  {
    id: 'panna-cotta',
    category: 'postres',
    name: 'Panna cotta',
    description: 'Tiembla un poco. Es buena señal.',
    ingredients: ['Nata', 'Vainilla', 'Frutos rojos'],
    image: PHOTO.pannaCotta,
    price: 4.9,
    vegetarian: true,
    layout: 'circle',
  },
  {
    id: 'helado',
    category: 'postres',
    name: 'Helado artesanal',
    description: 'Frío contra horno. Siempre funciona.',
    ingredients: ['Helado de la casa', 'Caramelo', 'Barquillo'],
    image: PHOTO.helado,
    price: 4.5,
    vegetarian: true,
    layout: 'wide',
  },
  {
    id: 'cookies',
    category: 'postres',
    name: 'Cookies del horno',
    description: 'Salen cuando ya no queda sitio. Y aun así entran.',
    ingredients: ['Chocolate', 'Mantequilla', 'Sal Maldon'],
    image: PHOTO.cookies,
    price: 3.9,
    vegetarian: true,
    layout: 'tall',
  },

  {
    id: 'extra-mozzarella',
    category: 'extras',
    name: 'Extra de mozzarella',
    description: 'Porque una vez no fue suficiente.',
    ingredients: ['Mozzarella fior di latte'],
    image: PHOTO.cheesePull,
    price: 1.5,
    vegetarian: true,
    layout: 'circle',
  },
  {
    id: 'salsa-tomate',
    category: 'extras',
    name: 'Salsa de tomate de la casa',
    description: 'La base de todo lo bueno que pasa aquí.',
    ingredients: ['Tomate San Marzano', 'Albahaca', 'Aceite'],
    image: PHOTO.tomato,
    price: 1.2,
    vegetarian: true,
    layout: 'wide',
  },
  {
    id: 'aceite-albahaca',
    category: 'extras',
    name: 'Aceite de albahaca',
    description: 'Un chorrito y otra pizza distinta.',
    ingredients: ['Aceite de oliva virgen extra', 'Albahaca'],
    image: PHOTO.oliveOil,
    price: 1.0,
    vegetarian: true,
    layout: 'tall',
  },
]

/* ── SELECTORES ─────────────────────────────────────────────── */
export const getProduct = (id) => PRODUCTS.find((p) => p.id === id) || null

export const productsByCategory = (categoryId) =>
  PRODUCTS.filter((p) => p.category === categoryId)

export const featuredProduct = () => PRODUCTS.find((p) => p.featured) || PRODUCTS[0]

export const popularProducts = () => PRODUCTS.filter((p) => p.popular)

/** Precio del producto. Quitar ingredientes no lo modifica. */
export const priceOf = (product) => product?.price ?? 0

/** ¿Es una pizza? Solo las pizzas muestran el diámetro. */
export const isPizza = (product) => product?.category === 'pizzas'
