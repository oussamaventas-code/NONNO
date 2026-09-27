/* Extensiones .js explícitas: este fichero también lo importan las
   funciones del servidor (ESM nativo de Node). */
import { PHOTO } from './images.js'

/* ═══════════════════════════════════════════════════════════════
   MENÚ — CARTA OFICIAL DE LA PIZZA DE NONNO

   Nombres, ingredientes y precios transcritos de la carta impresa.
   Las fotos siguen siendo de banco (o sin foto): sustituir por
   fotografía propia en src/data/images.js.

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
  clasica('margarita', 'Margarita', ['Tomate', 'Mozzarella'], 9.5,
    { image: PHOTO.margherita, vegetarian: true }),
  clasica('prosciutto', 'Prosciutto', ['Tomate', 'Mozzarella', 'Jamón cocido'], 10.5,
    { image: PHOTO.prosciutto }),
  clasica('hawaiana', 'Hawaiana', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Piña'], 10.9),
  clasica('salami', 'Salami', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Salami'], 10.9),
  clasica('pepperoni', 'Pepperoni', ['Tomate', 'Mozzarella', 'Pepperoni italiano'], 10.9,
    { image: PHOTO.diavola }),
  {
    id: 'a-tu-gusto',
    category: 'pizzas-clasicas',
    name: 'A tu gusto',
    description: 'Tomate y mozzarella, más los toppings que elijas (+1 € cada uno).',
    ingredients: ['Tomate', 'Mozzarella'],
    image: PHOTO.slicePull,
    price: 9.5,
    extras: TOPPINGS,
    badge: 'TÚ ELIGES',
    vegetarian: true,
  },
  clasica('fungi', 'Fungi', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Champiñón fresco'], 10.9,
    { image: PHOTO.funghi }),
  clasica('braulia', 'Braulia', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Salami', 'Champiñón fresco'], 10.9),
  clasica('atunazo', 'Atunazo', ['Tomate', 'Mozzarella', 'Atún', 'Cebolla', 'Orégano'], 10.9),
  clasica('todo-al-queso', 'Todo al queso', ['Tomate', 'Mozzarella', 'Gorgonzola', 'Gouda', 'Edam', 'Parmesano'], 10.9,
    { image: PHOTO.formaggi, vegetarian: true }),
  clasica('bacon', 'Bacon', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Bacon', 'Miel'], 10.9),
  clasica('guiris', 'Guiris', ['Tomate', 'Mozzarella', 'Bacon', 'Huevo fresco al centro'], 10.9),

  /* ── PIZZAS ESPECIALES ─────────────────────────────────────── */
  especial('nonno', 'Nonno', [
    'Tomate', 'Mozzarella', 'Rodajas de tomate fresco', 'Pimiento italiano',
    'Alcaparras', 'Cebolla', 'Champiñón fresco', 'Aceite de oliva',
  ], 11.9, { image: PHOTO.speciale, badge: 'LA DE LA CASA', featured: true, vegetarian: true }),
  especial('dulce-de-cabra', 'Dulce de cabra', ['Tomate', 'Mozzarella', 'Queso de cabra', 'Mermelada de tomate'], 11.9,
    { vegetarian: true }),
  especial('kebab', 'Kebab', ['Tomate', 'Mozzarella', 'Carne pollo kebab', 'Salsa blanca casera'], 11.9),
  especial('la-jefa', 'La Jefa', [
    'Tomate', 'Mozzarella', 'Jamón cocido', 'Alcachofas', 'Aceitunas negras', 'Anchoas',
  ], 11.9, { image: PHOTO.vegetale }),
  especial('chato-y-cabra', 'Chato y cabra', [
    'Tomate', 'Mozzarella', 'Sobrasada de chato murciano', 'Queso de cabra', 'Miel',
  ], 11.9),
  especial('mexicana', 'Mexicana', [
    'Tomate', 'Mozzarella', 'Chorizo picante', 'Ternera picada', 'Jalapeños', 'Aceite picante Nonno',
  ], 12.9, { spicy: true }),
  especial('iberica', 'Ibérica', [
    'Tomate', 'Mozzarella', 'Tomate fresco', 'Jamón serrano', 'Queso parmesano', 'Módena',
  ], 12.9, { image: PHOTO.bufala }),
  especial('carbonara', 'Carbonara tradicional', [
    'Mozzarella', 'Guanciale', 'Cebolla', 'Champiñón fresco', 'Pimienta',
  ], 12.9, { image: PHOTO.bianca }),
  especial('carnivora', 'Carnívora', [
    'Tomate', 'Mozzarella', 'Jamón cocido', 'Bacon', 'Carne de ternera', 'Pollo', 'Pepperoni',
  ], 12.9, { image: PHOTO.rustica }),
  especial('trufada', 'Trufada', ['Tomate', 'Mozzarella', 'Nueces', 'Champiñón fresco', 'Salsa de trufa'], 12.9,
    { image: PHOTO.tartufo, vegetarian: true }),
  especial('marinera', 'Marinera', ['Tomate', 'Mozzarella', 'Gambas', 'Calamares', 'Salsa verde casera'], 12.9),
  especial('barbacoa', 'Barbacoa', [
    'Base de salsa barbacoa', 'Mozzarella', 'Pollo', 'Bacon', 'Ternera picada', 'Cebolla',
  ], 12.9),

  /* ── CALZONES ──────────────────────────────────────────────── */
  calzone('calzone-prosciutto', 'Calzone Prosciutto', ['Tomate', 'Mozzarella', 'Jamón cocido', 'Parmesano'], 10.9),
  calzone('calzone-kebab', 'Calzone Kebab', ['Tomate', 'Mozzarella', 'Carne pollo kebab', 'Salsa blanca casera'], 11.9),
  calzone('calzone-serrano', 'Calzone Serrano', [
    'Tomate', 'Mozzarella', 'Berenjena', 'Jamón serrano', 'Parmesano', 'Módena',
  ], 11.9),

  /* ── ENTRANTES ─────────────────────────────────────────────── */
  {
    id: 'provolone',
    category: 'entrantes',
    name: 'Provolone',
    description: 'Base de tomate, queso provolone, tomate natural y orégano.',
    ingredients: ['Base de tomate', 'Queso provolone', 'Tomate natural', 'Orégano'],
    image: PHOTO.cheesePull,
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
    image: null,
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
    image: null,
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
    image: null,
    price: 2.9,
    vegetarian: true,
  },
  {
    id: 'boniatos',
    category: 'entrantes',
    name: 'Ración de boniatos fritos',
    description: 'Boniato frito.',
    ingredients: [],
    image: null,
    price: 3.9,
    vegetarian: true,
  },
  {
    id: 'nuggets',
    category: 'entrantes',
    name: 'Nuggets de pollo',
    description: '6 unidades.',
    ingredients: [],
    image: null,
    price: 4.9,
  },
  {
    id: 'fingers',
    category: 'entrantes',
    name: 'Fingers de pollo',
    description: '3 unidades.',
    ingredients: [],
    image: PHOTO.alitas,
    price: 4.9,
  },
  {
    id: 'ovni-camembert',
    category: 'entrantes',
    name: 'Ovni de camembert',
    description: '6 unidades.',
    ingredients: [],
    image: PHOTO.cheeses,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'tequenos',
    category: 'entrantes',
    name: 'Tequeños',
    description: '4 unidades.',
    ingredients: [],
    image: null,
    price: 4.9,
    vegetarian: true,
  },
  {
    id: 'palitos-mozzarella',
    category: 'entrantes',
    name: 'Palitos de mozzarella',
    description: '6 unidades.',
    ingredients: [],
    image: null,
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
    image: null,
    price: 8.9,
    vegetarian: true,
  },
  {
    id: 'calzone-tostarica',
    category: 'calzones-dulces',
    name: 'Tostarica',
    description: 'Base de masa horneada, crema de avellana y galleta Tosta Rica triturada.',
    ingredients: ['Crema de avellana', 'Galleta Tosta Rica triturada'],
    image: null,
    price: 8.9,
    vegetarian: true,
  },
  {
    id: 'calzone-pistacho',
    category: 'calzones-dulces',
    name: 'Dulce de pistacho',
    description: 'Base de masa horneada, crema de pistacho y almendra krunky.',
    ingredients: ['Crema de pistacho', 'Almendra krunky'],
    image: null,
    price: 8.9,
    vegetarian: true,
  },
  {
    id: 'calzone-lotus',
    category: 'calzones-dulces',
    name: 'Sweet Lotus',
    description: 'Base de masa horneada, crema de Lotus y galleta Lotus triturada.',
    ingredients: ['Crema de Lotus', 'Galleta Lotus triturada'],
    image: null,
    price: 8.9,
    vegetarian: true,
  },

  /* ── BEBIDAS ───────────────────────────────────────────────── */
  {
    id: 'bote',
    category: 'bebidas',
    name: 'Refresco en bote',
    description: 'Lata de 33 cl. Indica el sabor en la nota.',
    ingredients: [],
    image: null,
    price: 1.2,
  },
  {
    id: 'agua',
    category: 'bebidas',
    name: 'Agua 1,5 L',
    description: 'Botella de 1,5 litros.',
    ingredients: [],
    image: null,
    price: 1.2,
  },
  {
    id: 'cerveza-1l',
    category: 'bebidas',
    name: 'Cerveza 1 L',
    description: 'Botella de 1 litro.',
    ingredients: [],
    image: null,
    price: 3,
  },
  {
    id: 'coca-cola-2l',
    category: 'bebidas',
    name: 'Coca-Cola 2 L',
    description: 'Botella de 2 litros.',
    ingredients: [],
    image: null,
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

/* ── SELECTORES ─────────────────────────────────────────────── */
export const getProduct = (id) => PRODUCTS.find((p) => p.id === id) || null

export const productsByCategory = (categoryId) =>
  PRODUCTS.filter((p) => p.category === categoryId)

export const featuredProduct = () => PRODUCTS.find((p) => p.featured) || PRODUCTS[0]

/** Ración elegida (o la primera si el producto tiene raciones). */
export const getPortion = (product, portionId) =>
  product?.portions?.find((p) => p.id === portionId) || product?.portions?.[0] || null

/** Precio del producto. Quitar ingredientes no lo modifica. */
export const priceOf = (product, portionId) =>
  getPortion(product, portionId)?.price ?? product?.price ?? 0

/** ¿Es una pizza? Solo las pizzas muestran el diámetro. */
export const isPizza = (product) =>
  product?.category === 'pizzas-clasicas' || product?.category === 'pizzas-especiales'
