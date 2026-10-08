/* Extensiones .js explícitas: este fichero también lo importan las
   funciones del servidor (ESM nativo de Node). */
import { PHOTO } from './images.js'
import { applyDiscounts, isLive } from '../lib/discounts.js'

/* ═══════════════════════════════════════════════════════════════
   MENÚ — CARTA OFICIAL DE LA PIZZA DE NONNO

   Nombres, ingredientes y precios transcritos de la carta impresa.
   Las fotografías propias de los platos se asignan en src/data/images.js;
   se conserva una imagen editorial cuando no hay una coincidencia clara.

   ESQUEMA DE PRODUCTO
   ───────────────────
   id           string    único
   category     string    id de CATEGORIES
   name         string
   description  string    el texto de la carta
   ingredients  string[]  el cliente puede QUITAR cualquiera de ellos
                          sin cambiar el precio ni el nombre
   image        string?   id de PHOTO; null → la web pinta un hueco de marca
   price        number    precio de la ración normal
   portions     array?    [{ id, label, price }] cuando hay media ración
   extras       string[]  ids de EXTRAS permitidos en este producto
   badge        string    etiqueta opcional
   featured     bool      sale en "La favorita del Nonno"
   vegetarian   bool
   spicy        bool
   ═══════════════════════════════════════════════════════════════ */

/* Puestos de cocina: cada uno recibe su propio ticket al imprimir. */
export const STATIONS = [
  { id: 'entrantes', label: 'ENTRANTES' },
  { id: 'pizzas', label: 'PIZZAS · HORNO' },
  { id: 'bebidas', label: 'BEBIDAS' },
]

export const CATEGORIES = [
  { id: 'pizzas-clasicas', label: 'PIZZAS CLÁSICAS', station: 'pizzas' },
  { id: 'pizzas-especiales', label: 'PIZZAS ESPECIALES', station: 'pizzas' },
  { id: 'calzones', label: 'CALZONES', station: 'pizzas' },
  { id: 'entrantes', label: 'ENTRANTES', station: 'entrantes' },
  { id: 'calzones-dulces', label: 'CALZONES DULCES', station: 'pizzas' },
  { id: 'nonnitos-dulces', label: 'NONNITOS DULCES', station: 'pizzas' },
  { id: 'bebidas', label: 'BEBIDAS', station: 'bebidas' },
]

/** Puesto de cocina de una categoría. Los pedidos antiguos guardaban
    'pizzas' / 'entrantes' / 'bebidas', que ya son ids de puesto. */
export const stationOf = (categoryId) =>
  CATEGORIES.find((c) => c.id === categoryId)?.station
  || (STATIONS.some((s) => s.id === categoryId) ? categoryId : null)

/* ── TAMAÑO ─────────────────────────────────────────────────────
   Un único tamaño de pizza. Se muestra como dato, no como elección. */
export const PIZZA_SIZE = { diameter: '33 cm' }

/* ── TOPPINGS ───────────────────────────────────────────────────
   La carta dice "TOPPING +1€": se puede añadir cualquier ingrediente
   de las pizzas de la carta, todos al mismo precio. */
const TOPPING = 1
export const EXTRAS = [
  { id: 'mozzarella', label: 'Extra mozzarella', price: TOPPING, group: 'Quesos' },
  { id: 'cabra', label: 'Queso de cabra', price: TOPPING, group: 'Quesos' },
  { id: 'gorgonzola', label: 'Gorgonzola', price: TOPPING, group: 'Quesos' },
  { id: 'gouda', label: 'Gouda', price: TOPPING, group: 'Quesos' },
  { id: 'edam', label: 'Edam', price: TOPPING, group: 'Quesos' },
  { id: 'parmesano', label: 'Parmesano', price: TOPPING, group: 'Quesos' },
  { id: 'jamon-cocido', label: 'Jamón cocido', price: TOPPING, group: 'Carnes' },
  { id: 'jamon-serrano', label: 'Jamón serrano', price: TOPPING, group: 'Carnes' },
  { id: 'bacon', label: 'Bacon', price: TOPPING, group: 'Carnes' },
  { id: 'pepperoni', label: 'Pepperoni', price: TOPPING, group: 'Carnes' },
  { id: 'salami', label: 'Salami', price: TOPPING, group: 'Carnes' },
  { id: 'pollo', label: 'Pollo', price: TOPPING, group: 'Carnes' },
  { id: 'kebab', label: 'Carne kebab', price: TOPPING, group: 'Carnes' },
  { id: 'ternera', label: 'Ternera picada', price: TOPPING, group: 'Carnes' },
  { id: 'chorizo', label: 'Chorizo picante', price: TOPPING, group: 'Carnes' },
  { id: 'sobrasada', label: 'Sobrasada de chato murciano', price: TOPPING, group: 'Carnes' },
  { id: 'guanciale', label: 'Guanciale', price: TOPPING, group: 'Carnes' },
  { id: 'atun', label: 'Atún', price: TOPPING, group: 'Del mar' },
  { id: 'anchoas', label: 'Anchoas', price: TOPPING, group: 'Del mar' },
  { id: 'gambas', label: 'Gambas', price: TOPPING, group: 'Del mar' },
  { id: 'calamares', label: 'Calamares', price: TOPPING, group: 'Del mar' },
  { id: 'champinon', label: 'Champiñón', price: TOPPING, group: 'Verduras' },
  { id: 'cebolla', label: 'Cebolla', price: TOPPING, group: 'Verduras' },
  { id: 'pimiento', label: 'Pimiento italiano', price: TOPPING, group: 'Verduras' },
  { id: 'tomate-fresco', label: 'Tomate fresco', price: TOPPING, group: 'Verduras' },
  { id: 'aceitunas', label: 'Aceitunas negras', price: TOPPING, group: 'Verduras' },
  { id: 'alcachofa', label: 'Alcachofas', price: TOPPING, group: 'Verduras' },
  { id: 'alcaparras', label: 'Alcaparras', price: TOPPING, group: 'Verduras' },
  { id: 'berenjena', label: 'Berenjena', price: TOPPING, group: 'Verduras' },
  { id: 'jalapenos', label: 'Jalapeños', price: TOPPING, group: 'Verduras' },
  { id: 'pina', label: 'Piña', price: TOPPING, group: 'Verduras' },
  { id: 'nueces', label: 'Nueces', price: TOPPING, group: 'Otros' },
  { id: 'huevo', label: 'Huevo fresco', price: TOPPING, group: 'Otros' },
  { id: 'miel', label: 'Miel', price: TOPPING, group: 'Salsas y toques' },
  { id: 'mermelada-tomate', label: 'Mermelada de tomate', price: TOPPING, group: 'Salsas y toques' },
  { id: 'salsa-blanca', label: 'Salsa blanca casera', price: TOPPING, group: 'Salsas y toques' },
  { id: 'salsa-verde', label: 'Salsa verde casera', price: TOPPING, group: 'Salsas y toques' },
  { id: 'salsa-trufa', label: 'Salsa de trufa', price: TOPPING, group: 'Salsas y toques' },
  { id: 'salsa-barbacoa', label: 'Salsa barbacoa', price: TOPPING, group: 'Salsas y toques' },
  { id: 'aceite-picante', label: 'Aceite picante Nonno', price: TOPPING, group: 'Salsas y toques' },
  { id: 'modena', label: 'Módena', price: TOPPING, group: 'Salsas y toques' },
]

export const getExtra = (id) => EXTRAS.find((e) => e.id === id) || null

const TOPPINGS = EXTRAS.map((e) => e.id)

/* ── PRODUCTOS ──────────────────────────────────────────────── */
const pizza = (category, id, name, ingredients, price, rest = {}) => ({
  id,
  category,
  name,
  description: `${ingredients.join(', ')}.`,
  ingredients,
  image: null,
  price,
  extras: TOPPINGS,
  ...rest,
})

const clasica = (...args) => pizza('pizzas-clasicas', ...args)
const especial = (...args) => pizza('pizzas-especiales', ...args)
const calzone = (...args) => pizza('calzones', ...args)

export const PRODUCTS = [
  /* ── PIZZAS CLÁSICAS ───────────────────────────────────────── */
  clasica('margarita', 'Margarita', ['Tomate', 'Mozzarella', 'Albahaca'], 9.5,
    { image: PHOTO.margherita, vegetarian: true }),
  clasica('prosciutto', 'Prosciutto', ['Tomate', 'Mozzarella', 'Jamón cocido'], 10.5,
    { image: PHOTO.prosciutto }),
  clasica('hawaiana', 'Hawaiana', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Piña'], 10.9,
    { image: PHOTO.hawaiana }),
  clasica('salami', 'Salami', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Salami'], 10.9,
    { image: PHOTO.salami }),
  clasica('pepperoni', 'Pepperoni', ['Tomate', 'Mozzarella', 'Pepperoni italiano'], 10.9,
    { image: PHOTO.diavola }),
  {
    id: 'a-tu-gusto',
    category: 'pizzas-clasicas',
    name: 'A tu gusto',
    description: 'Tomate y mozzarella, más los toppings que elijas (+1 € cada uno).',
    ingredients: ['Tomate', 'Mozzarella'],
    image: PHOTO.aTuGusto,
    price: 9.5,
    extras: TOPPINGS,
    badge: 'TÚ ELIGES',
    vegetarian: true,
  },
  clasica('fungi', 'Fungi', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Champiñón fresco'], 10.9,
    { image: PHOTO.funghi }),
  clasica('braulia', 'Braulia', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Salami', 'Champiñón fresco'], 10.9,
    { image: PHOTO.braulia }),
  clasica('atunazo', 'Atunazo', ['Tomate', 'Mozzarella', 'Atún', 'Cebolla', 'Orégano'], 10.9,
    { image: PHOTO.atunazo }),
  clasica('todo-al-queso', 'Todo al queso', ['Tomate', 'Mozzarella', 'Gorgonzola', 'Gouda', 'Edam', 'Parmesano'], 10.9,
    { image: PHOTO.formaggi, vegetarian: true }),
  clasica('bacon', 'Bacon', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Bacon', 'Miel'], 10.9,
    { image: PHOTO.bacon }),
  clasica('guiris', 'Guiris', ['Tomate', 'Mozzarella', 'Bacon', 'Huevo fresco al centro'], 10.9,
    { image: PHOTO.guiris }),

  /* ── PIZZAS ESPECIALES ─────────────────────────────────────── */
  especial('nonno', 'Nonno', [
    'Tomate', 'Mozzarella', 'Rodajas de tomate fresco', 'Pimiento italiano',
    'Alcaparras', 'Cebolla', 'Champiñón fresco', 'Aceite de oliva',
  ], 11.9, { image: PHOTO.nonno, badge: 'LA DE LA CASA', featured: true, vegetarian: true }),
  especial('dulce-de-cabra', 'Dulce de cabra', ['Tomate', 'Mozzarella', 'Queso de cabra', 'Mermelada de tomate'], 11.9,
    { image: PHOTO.dulceDeCabra, vegetarian: true }),
  especial('kebab', 'Kebab', ['Tomate', 'Mozzarella', 'Carne pollo kebab', 'Salsa blanca casera'], 11.9,
    { image: PHOTO.kebabPizza }),
  especial('la-jefa', 'La Jefa', [
    'Tomate', 'Mozzarella', 'Jamón cocido', 'Alcachofas', 'Aceitunas negras', 'Anchoas',
  ], 11.9, { image: PHOTO.laJefa }),
  especial('chato-y-cabra', 'Chato y cabra', [
    'Tomate', 'Mozzarella', 'Sobrasada de chato murciano', 'Queso de cabra', 'Miel',
  ], 11.9, { image: PHOTO.chatoYCabra }),
  especial('mexicana', 'Mexicana', [
    'Tomate', 'Mozzarella', 'Chorizo picante', 'Ternera picada', 'Jalapeños', 'Aceite picante Nonno',
  ], 12.9, { image: PHOTO.mexicana, spicy: true }),
  especial('iberica', 'Ibérica', [
    'Tomate', 'Mozzarella', 'Tomate fresco', 'Jamón serrano', 'Queso parmesano', 'Módena',
  ], 12.9, { image: PHOTO.iberica }),
  especial('carbonara', 'Carbonara tradicional', [
    'Mozzarella', 'Guanciale', 'Cebolla', 'Champiñón fresco', 'Pimienta',
  ], 12.9, { image: PHOTO.carbonara }),
  especial('carnivora', 'Carnívora', [
    'Tomate', 'Mozzarella', 'Jamón cocido', 'Bacon', 'Carne de ternera', 'Pollo', 'Pepperoni',
  ], 12.9, { image: PHOTO.carnivora }),
  especial('trufada', 'Trufada', ['Tomate', 'Mozzarella', 'Nueces', 'Champiñón fresco', 'Salsa de trufa'], 12.9,
    { image: PHOTO.trufada, vegetarian: true }),
  especial('marinera', 'Marinera', ['Tomate', 'Mozzarella', 'Gambas', 'Calamares', 'Salsa verde casera'], 12.9,
    { image: PHOTO.marinera }),
  especial('barbacoa', 'Barbacoa', [
    'Base de salsa barbacoa', 'Mozzarella', 'Pollo', 'Bacon', 'Ternera picada', 'Cebolla',
  ], 12.9, { image: PHOTO.barbacoa }),

  /* ── CALZONES ──────────────────────────────────────────────── */
  calzone('calzone-prosciutto', 'Calzone Prosciutto', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Parmesano'], 10.9,
    { image: PHOTO.calzoneProsciutto }),
  calzone('calzone-kebab', 'Calzone Kebab', ['Tomate', 'Mozzarella', 'Carne pollo kebab', 'Salsa blanca casera'], 11.9,
    { image: PHOTO.calzoneKebab }),
  calzone('calzone-serrano', 'Calzone Serrano', [
    'Tomate', 'Mozzarella', 'Berenjena', 'Jamón serrano', 'Parmesano', 'Módena',
  ], 11.9, { image: PHOTO.calzoneSerrano }),

  /* ── ENTRANTES ─────────────────────────────────────────────── */
  {
    id: 'provolone',
    category: 'entrantes',
    name: 'Provolone',
    description: 'Base de tomate, queso provolone, tomate natural y orégano.',
    ingredients: ['Base de tomate', 'Queso provolone', 'Tomate natural', 'Orégano'],
    image: PHOTO.provolone,
    price: 5.9,
    vegetarian: true,
  },
  {
    id: 'pan-de-ajo',
    category: 'entrantes',
    name: 'Pan de ajo',
    description: 'Mozzarella, cebolla y salsa verde casera.',
    ingredients: ['Mozzarella', 'Cebolla', 'Salsa verde casera'],
    image: PHOTO.panDeAjo,
    price: 5.9,
    vegetarian: true,
  },
  {
    id: 'patatas-cheese-bacon',
    category: 'entrantes',
    name: 'Patatas cheese bacon',
    description: 'Patatas fritas con queso fundido y bacon.',
    ingredients: ['Queso', 'Bacon'],
    image: PHOTO.patatasCheeseBacon,
    price: 7.9,
    portions: [
      { id: 'racion', label: 'Ración', price: 7.9 },
      { id: 'media', label: '½ ración', price: 4.9 },
    ],
  },
  {
    id: 'patatas-cheese-kebab',
    category: 'entrantes',
    name: 'Patatas cheese kebab',
    description: 'Patatas fritas con queso fundido y carne kebab.',
    ingredients: ['Queso', 'Carne kebab'],
    image: PHOTO.patatasCheeseKebab,
    price: 7.9,
    portions: [
      { id: 'racion', label: 'Ración', price: 7.9 },
      { id: 'media', label: '½ ración', price: 4.9 },
    ],
  },
  {
    id: 'patatas-fritas',
    category: 'entrantes',
    name: 'Ración de patatas fritas',
    description: 'Patatas fritas.',
    ingredients: [],
    image: PHOTO.patatasFritas,
    price: 2.9,
    vegetarian: true,
  },
  {
    id: 'boniatos',
    category: 'entrantes',
    name: 'Ración de boniatos fritos',
    description: 'Boniato frito.',
    ingredients: [],
    image: PHOTO.boniatos,
    price: 3.9,
    vegetarian: true,
  },
  {
    id: 'nuggets',
    category: 'entrantes',
    name: 'Nuggets de pollo',
    description: '6 unidades.',
    ingredients: [],
    image: PHOTO.nuggets,
    price: 4.9,
  },
  {
    id: 'fingers',
    category: 'entrantes',
    name: 'Tiras de pollo',
    description: 'Fingers de pollo crujientes.',
    ingredients: [],
    image: PHOTO.fingers,
    price: 5.9,
  },
  {
    id: 'alitas',
    category: 'entrantes',
    name: 'Alitas de pollo',
    description: 'Alitas de pollo.',
    ingredients: [],
    image: PHOTO.alitas,
    price: 5.9,
  },
  {
    id: 'ovni-camembert',
    category: 'entrantes',
    name: 'Ovni de camembert',
    description: '6 unidades.',
    ingredients: [],
    image: PHOTO.camembertBites,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'tequenos',
    category: 'entrantes',
    name: 'Tequeños',
    description: '4 unidades.',
    ingredients: [],
    image: PHOTO.tequenos,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'palitos-mozzarella',
    category: 'entrantes',
    name: 'Palitos de mozzarella',
    description: '6 unidades.',
    ingredients: [],
    image: PHOTO.palitosMozzarella,
    price: 4.9,
    vegetarian: true,
  },

  /* ── CALZONES DULCES ───────────────────────────────────────── */
  {
    id: 'calzone-oreo',
    category: 'calzones-dulces',
    name: 'Oreo',
    description: 'Base de masa horneada, crema de chocolate blanco y galleta Oreo triturada.',
    ingredients: ['Crema de chocolate blanco', 'Galleta Oreo triturada'],
    image: PHOTO.oreoDessert,
    price: 8.9,
    vegetarian: true,
  },
  {
    id: 'calzone-tostarica',
    category: 'calzones-dulces',
    name: 'Tostarica',
    description: 'Base de masa horneada, crema de avellana y galleta Tosta Rica triturada.',
    ingredients: ['Crema de avellana', 'Galleta Tosta Rica triturada'],
    image: PHOTO.tostaricaDessert,
    price: 8.9,
    vegetarian: true,
  },
  {
    id: 'calzone-pistacho',
    category: 'calzones-dulces',
    name: 'Dulce de pistacho',
    description: 'Base de masa horneada, crema de pistacho y almendra krunky.',
    ingredients: ['Crema de pistacho', 'Almendra krunky'],
    image: PHOTO.pistachoDessert,
    price: 8.9,
    vegetarian: true,
  },
  {
    id: 'calzone-lotus',
    category: 'calzones-dulces',
    name: 'Sweet Lotus',
    description: 'Base de masa horneada, crema de Lotus y galleta Lotus triturada.',
    ingredients: ['Crema de Lotus', 'Galleta Lotus triturada'],
    image: PHOTO.lotusDessert,
    price: 8.9,
    vegetarian: true,
  },

  /* ── NONNITOS DULCES ───────────────────────────────────────── */
  {
    id: 'nonnitos-lotus',
    category: 'nonnitos-dulces',
    name: 'Nonnitos de Lotus',
    description: 'Bocaditos de masa horneada con crema y galleta Lotus.',
    ingredients: [],
    image: PHOTO.nonnitoLotus,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'nonnitos-nutella',
    category: 'nonnitos-dulces',
    name: 'Nonnitos de Nutella',
    description: 'Bocaditos de masa horneada con Nutella.',
    ingredients: [],
    image: PHOTO.nonnitoNutella,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'nonnitos-oreo',
    category: 'nonnitos-dulces',
    name: 'Nonnitos de Oreo',
    description: 'Bocaditos de masa horneada con crema de chocolate blanco y Oreo.',
    ingredients: [],
    image: PHOTO.nonnitoOreo,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'nonnitos-pistacho',
    category: 'nonnitos-dulces',
    name: 'Nonnitos de pistacho',
    description: 'Bocaditos de masa horneada con crema de pistacho.',
    ingredients: [],
    image: PHOTO.nonnitoPistacho,
    price: 4.9,
    vegetarian: true,
  },

  /* ── BEBIDAS ───────────────────────────────────────────────── */
  {
    id: 'bote',
    category: 'bebidas',
    name: 'Refresco en bote',
    description: 'Lata de 33 cl. Indica el sabor en la nota.',
    ingredients: [],
    image: PHOTO.refrescoBote,
    price: 1.2,
  },
  {
    id: 'agua',
    category: 'bebidas',
    name: 'Agua 1,5 L',
    description: 'Botella de 1,5 litros.',
    ingredients: [],
    image: PHOTO.aguaBotella,
    price: 1.2,
  },
  {
    id: 'cerveza-1l',
    category: 'bebidas',
    name: 'Cerveza 1 L',
    description: 'Botella de 1 litro.',
    ingredients: [],
    image: PHOTO.cervezaBotella,
    price: 3,
  },
  {
    id: 'coca-cola-2l',
    category: 'bebidas',
    name: 'Coca-Cola 2 L',
    description: 'Botella de 2 litros.',
    ingredients: [],
    image: PHOTO.colaBotella,
    price: 3,
  },
]

/* ── LLÉVATELAS POR MENOS ───────────────────────────────────────
   Ofertas de la carta, válidas SOLO para recogida en el local.
   Cada pack sustituye el precio base de esas pizzas; los toppings
   extra se siguen cobrando aparte. Clásicas y especiales no se
   mezclan en un mismo pack. */
export const PICKUP_DEALS = [
  {
    category: 'pizzas-clasicas',
    label: 'pizzas clásicas',
    packs: [{ qty: 2, price: 19 }, { qty: 3, price: 28 }, { qty: 5, price: 45 }],
  },
  {
    category: 'pizzas-especiales',
    label: 'pizzas especiales',
    packs: [{ qty: 2, price: 21 }, { qty: 3, price: 31 }, { qty: 5, price: 50 }],
  },
]

/* ── CARTA EDITABLE ─────────────────────────────────────────────
   La carta base vive aquí arriba. Desde el panel se pueden corregir
   por encima: precio, producto oculto y "agotado" por sede. Los
   selectores de abajo devuelven siempre la carta ya corregida, así
   que la web, el carrito y el servidor cuentan con los mismos precios.
   Sin correcciones (base de datos sin conectar) es la carta de siempre. */
let overrides = { prices: {}, hidden: [], soldOut: {}, ingredients: {}, discounts: [], content: {} }
let effective = PRODUCTS

const applyPrices = (product, o) => {
  if (!o) return product
  const next = { ...product }
  if (o.price != null && !product.portions) next.price = o.price
  if (o.portionPrices && product.portions) {
    next.portions = product.portions.map((p) => (
      o.portionPrices[p.id] != null ? { ...p, price: o.portionPrices[p.id] } : p
    ))
    next.price = next.portions[0].price
  }
  return next
}

const applyProductContent = (product, patch) => {
  if (!patch || typeof patch !== 'object') return product
  const next = { ...product }
  for (const key of ['name', 'category', 'description', 'image']) {
    if (typeof patch[key] === 'string') next[key] = patch[key]
  }
  if (patch.image === null) next.image = product.image || null
  if (Array.isArray(patch.ingredients)) next.ingredients = patch.ingredients
  if (Array.isArray(patch.allergens)) next.allergens = patch.allergens
  return next
}

/** Sustituye las correcciones de precio, contenido, disponibilidad y descuentos. */
export function setMenuOverrides(next) {
  overrides = {
    prices: next?.prices || {},
    hidden: Array.isArray(next?.hidden) ? next.hidden : [],
    soldOut: next?.soldOut || {},
    ingredients: next?.ingredients || {},
    discounts: Array.isArray(next?.discounts) ? next.discounts : [],
    content: next?.content || {},
  }
  /* Primero el precio de la carta; encima, el descuento en vigor */
  const live = overrides.discounts.filter((d) => isLive(d))
  effective = PRODUCTS.map((p) => applyDiscounts(
    applyPrices(applyProductContent(p, overrides.content[p.id]), overrides.prices[p.id]),
    live
  ))
}

export const getMenuOverrides = () => overrides

/** Producto oculto de la carta (no se vende en la web). */
export const isHidden = (id) => overrides.hidden.includes(id)

/* ── INGREDIENTES ───────────────────────────────────────────────
   Cada local puede marcar un ingrediente como agotado. Las pizzas que
   lo llevan se descartan solas en esa sede (no hace falta ir una a una)
   y el topping equivalente deja de poder añadirse. La clave es el
   nombre sin tildes ni mayúsculas, y sin el "Extra " de los toppings,
   así "Extra mozzarella" y "Mozzarella" son el mismo ingrediente. */
export const ingredientKey = (label) =>
  String(label ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim().replace(/\s+/g, ' ')
    .replace(/^extra /, '')

/** Todos los ingredientes de la carta: [{ key, label, group }]. */
export function ingredientCatalog() {
  const map = new Map()
  for (const e of EXTRAS) {
    const key = ingredientKey(e.label)
    if (!map.has(key)) map.set(key, { key, label: e.label.replace(/^Extra /, '').replace(/^./, (c) => c.toUpperCase()), group: e.group })
  }
  for (const p of effective) {
    for (const name of p.ingredients || []) {
      const key = ingredientKey(name)
      if (key && !map.has(key)) map.set(key, { key, label: name, group: 'Base y otros de las pizzas' })
    }
  }
  return [...map.values()]
}

/** Productos de la carta que llevan ese ingrediente. */
export const productsUsing = (key) =>
  effective.filter((p) => (p.ingredients || []).some((i) => ingredientKey(i) === key))

/** Ingredientes agotados en esa sede (claves). */
export const ingredientsOut = (locationId) =>
  (locationId && overrides.ingredients[locationId]) || []

export const isIngredientOut = (key, locationId) => ingredientsOut(locationId).includes(key)

/** Nombres de los ingredientes agotados que lleva el producto en esa sede. */
export function missingIngredients(productId, locationId) {
  const out = ingredientsOut(locationId)
  if (!out.length) return []
  const product = effective.find((p) => p.id === productId)
  return (product?.ingredients || []).filter((i) => out.includes(ingredientKey(i)))
}

/** ¿El topping (extra) lleva un ingrediente agotado en esa sede? */
export const isExtraOut = (extraId, locationId) => {
  const extra = EXTRAS.find((e) => e.id === extraId)
  return Boolean(extra) && isIngredientOut(ingredientKey(extra.label), locationId)
}

/** Agotado a mano por el local en esa sede (sin contar ingredientes). */
export const isManuallySoldOut = (id, locationId) =>
  Boolean(locationId && overrides.soldOut[locationId]?.includes(id))

/** Producto agotado en esa sede: a mano, o porque le falta un ingrediente.
    Sin sede elegida no se puede saber: no cuenta. */
export const isSoldOut = (id, locationId) =>
  isManuallySoldOut(id, locationId) || missingIngredients(id, locationId).length > 0

/** ¿Se puede pedir en la web ahora mismo? */
export const isOrderable = (id, locationId) => !isHidden(id) && !isSoldOut(id, locationId)

/** Carta completa con precios corregidos, incluidos los ocultos (para el panel). */
export const allProducts = () => effective

/** Lo que ve el cliente: sin los ocultos. */
export const visibleProducts = () => effective.filter((p) => !isHidden(p.id))

/* ── SELECTORES ─────────────────────────────────────────────── */
export const getProduct = (id) => effective.find((p) => p.id === id) || null

export const productsByCategory = (categoryId) =>
  visibleProducts().filter((p) => p.category === categoryId)

export const featuredProduct = () => visibleProducts().find((p) => p.featured) || visibleProducts()[0]

/** Ración elegida (o la primera si el producto tiene raciones). */
export const getPortion = (product, portionId) =>
  product?.portions?.find((p) => p.id === portionId) || product?.portions?.[0] || null

/** Precio del producto. Quitar ingredientes no lo modifica. */
export const priceOf = (product, portionId) =>
  getPortion(product, portionId)?.price ?? product?.price ?? 0

/** ¿Es una pizza? Solo las pizzas muestran el diámetro. */
export const isPizza = (product) =>
  product?.category === 'pizzas-clasicas' || product?.category === 'pizzas-especiales'
