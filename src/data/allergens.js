/* ═══════════════════════════════════════════════════════════════
   ALÉRGENOS — LISTADO OFICIAL DE LA PIZZA DE NONNO

   Transcrito de "F-PRQ 9.1 Listado de alérgenos", Ed. 00, fecha de
   edición 11/09/2025 (páginas 1 y 2 de 3). Los 14 alérgenos del
   Reglamento (UE) 1169/2011, en el mismo orden que la tabla.

   contains  X en la tabla: el plato lleva el alérgeno
   traces    T en la tabla: puede contener trazas

   Un producto que no está aquí no tiene ficha todavía (la página 3
   de la tabla no se ha transcrito): la web lo dice y manda a llamar
   al local, nunca lo da por libre de alérgenos.
   ═══════════════════════════════════════════════════════════════ */

export const ALLERGENS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'crustaceos', label: 'Crustáceos' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'moluscos', label: 'Moluscos' },
  { id: 'cacahuetes', label: 'Cacahuetes' },
  { id: 'soja', label: 'Soja' },
  { id: 'lacteos', label: 'Lácteos' },
  { id: 'frutos-cascara', label: 'Frutos de cáscara' },
  { id: 'apio', label: 'Apio' },
  { id: 'huevos', label: 'Huevos' },
  { id: 'altramuces', label: 'Altramuces' },
  { id: 'sesamo', label: 'Sésamo' },
  { id: 'mostaza', label: 'Mostaza' },
  { id: 'sulfitos', label: 'Sulfitos' },
]

export const getAllergen = (id) => ALLERGENS.find((a) => a.id === id) || null

export const ALLERGEN_SOURCE = 'Listado de alérgenos · Ed. 00 · 11/09/2025'

export const ALLERGEN_NOTICE =
  'En La Pizza de Nonno se trabaja con varios alérgenos, por lo que no se puede garantizar ' +
  'que no se produzca contaminación cruzada entre productos durante la producción, ' +
  'el almacenamiento o la venta.'

/* Base de casi todas las pizzas: masa (gluten) y mozzarella (lácteos),
   con trazas de cacahuete y sulfitos por el obrador. */
const base = (extra = {}) => ({
  contains: ['gluten', 'lacteos', ...(extra.contains || [])],
  traces: extra.traces || ['cacahuetes', 'sulfitos'],
  ...(extra.note ? { note: extra.note } : {}),
})
/* Sulfitos marcados con X en vez de T (Módena, salsa verde…) */
const sulfitos = { traces: ['cacahuetes'] }

const BY_PRODUCT = {
  /* Pizzas clásicas */
  margarita: base(),
  prosciutto: base(),
  hawaiana: base(),
  salami: base({ contains: ['soja'] }),
  pepperoni: base(),
  fungi: base(),
  braulia: base({ contains: ['soja'] }),
  atunazo: base({ contains: ['pescado'] }),
  'todo-al-queso': base(),
  bacon: base({ contains: ['soja'] }),
  guiris: base({ contains: ['soja', 'huevos'] }),
  'a-tu-gusto': base({ note: 'Base de tomate y mozzarella. Cada topping que añadas puede sumar sus alérgenos: mira la ficha de la pizza que lo lleva.' }),

  /* Pizzas especiales */
  nonno: base(),
  'dulce-de-cabra': base(),
  kebab: base({ contains: ['huevos', 'mostaza'] }),
  'la-jefa': base({ contains: ['pescado'] }),
  'chato-y-cabra': base(),
  mexicana: base({ contains: ['soja'] }),
  iberica: base({ contains: ['sulfitos'], ...sulfitos }),
  carbonara: base(),
  carnivora: base({ contains: ['soja'] }),
  trufada: base({ contains: ['frutos-cascara'] }),
  /* La tabla no marca moluscos, pero la Marinera lleva calamares,
     que lo son: se añade para no quedarse corto. */
  marinera: base({ contains: ['crustaceos', 'pescado', 'moluscos', 'sulfitos'], ...sulfitos }),
  barbacoa: base({ contains: ['soja'] }),

  /* Calzones */
  'calzone-prosciutto': base(),
  'calzone-kebab': base({ contains: ['huevos', 'mostaza'] }),
  'calzone-serrano': base({ contains: ['sulfitos'], ...sulfitos }),

  /* Entrantes */
  provolone: { contains: ['lacteos'], traces: ['cacahuetes', 'sulfitos'] },
  'patatas-cheese-bacon': {
    contains: ['cacahuetes', 'soja', 'lacteos', 'huevos', 'mostaza', 'sulfitos'],
    traces: [],
  },
  'patatas-fritas': { contains: [], traces: [] },
  boniatos: { contains: [], traces: [] },
  nuggets: {
    contains: ['gluten'],
    traces: [],
    note: 'Con salsa blanca suma lácteos, huevos y mostaza.',
  },
  'ovni-camembert': { contains: ['gluten', 'lacteos'], traces: [] },
}

/** Ficha de alérgenos de un producto, o null si aún no la tenemos. */
export const allergensOf = (productId) => BY_PRODUCT[productId] || null

/** ¿Es apto para alguien que evita estos alérgenos? (trazas incluidas si se pide) */
export function isSafeFor(productId, avoid, { strict = false } = {}) {
  const a = allergensOf(productId)
  if (!a) return null
  return !avoid.some((id) => a.contains.includes(id) || (strict && a.traces.includes(id)))
}
