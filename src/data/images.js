/* ═══════════════════════════════════════════════════════════════
   LIBRERÍA DE IMÁGENES
   Todas las URLs son reales (Unsplash) y han sido verificadas.
   Centralizadas aquí para poder sustituirlas por FOTOGRAFÍA PROPIA
   de Nonno sin tocar ni un componente.

   TODO: REEMPLAZAR POR FOTOGRAFÍA REAL DEL RESTAURANTE.
   ═══════════════════════════════════════════════════════════════ */

const UNSPLASH = 'https://images.unsplash.com/photo-'

/**
 * Construye la URL con los parámetros de optimización de Unsplash.
 * @param {string} id  identificador del photo
 * @param {number} w   ancho servido (usar el mayor que se vaya a pintar)
 * @param {number} q   calidad 1-100
 */
export const img = (id, w = 1200, q = 80) =>
  isOwn(id)
    ? ownSrc(id, w)
    : `${UNSPLASH}${id}?w=${w}&q=${q}&auto=format&fit=crop`

/** srcSet responsive para las imágenes grandes (hero, editorial, destacado) */
export const srcSet = (id, widths = [640, 960, 1400, 1920]) =>
  isOwn(id)
    ? OWN_WIDTHS.map((w) => `${ownSrc(id, w)} ${w}w`).join(', ')
    : widths.map((w) => `${img(id, w)} ${w}w`).join(', ')

/* ── Fotografía propia ───────────────────────────────────────────
   Los ids 'own:nombre' apuntan a /public/fotos/pizzas/nombre-{ancho}.webp,
   exportadas en OWN_WIDTHS. Se sirve la menor que cubra el ancho pedido. */
const OWN = 'own:'
const OWN_WIDTHS = [600, 1200]
const isOwn = (id) => typeof id === 'string' && id.startsWith(OWN)
const ownSrc = (id, w) => {
  const width = OWN_WIDTHS.find((x) => x >= w) || OWN_WIDTHS[OWN_WIDTHS.length - 1]
  return `/fotos/pizzas/${id.slice(OWN.length)}-${width}.webp`
}

/* ── IDs verificados ─────────────────────────────────────────── */
export const PHOTO = {
  // Marca / editorial
  heroPizza: '1513104890138-7c749659a591', // porciones sobre madera oscura
  ovenFire: '1579751626657-72bc17010498', // pizza dentro del horno de leña
  doughBread: '1509440159596-0249088772ff', // panes rústicos + trigo
  flour: '1627485937980-221c88ac04f9', // harina y espigas
  basil: '1618375569909-3c8616cf7733', // albahaca fresca
  tomato: '1592924357228-91a4daadcfea', // tomates en rama
  cheesePull: '1541745537411-b8046dc6d66c', // hilo de queso macro
  oliveOil: '1474979266404-7eaacbcd87c5', // aceite y aceitunas
  cheeses: '1628088062854-d1870b4553da', // tabla de quesos
  table: '1481931098730-318b6f776db0', // mesa servida
  slicePull: '1520201163981-8cc95007dd2a', // porción levantada con queso

  // Sedes
  venueSangonera: 'own:local-sangonera',
  venueSantoAngel: 'own:local-santo-angel',

  // Pizzas
  margherita: 'own:margarita',
  diavola: 'own:pepperoni',
  prosciutto: 'own:prosciutto',
  formaggi: 'own:todo-al-queso',
  vegetale: '1593560708920-61dd98c46a4e',
  speciale: '1574071318508-1cdbab80d002',
  funghi: 'own:fungi',
  bufala: '1565299624946-b28f40a0ae38',
  bianca: '1571997478779-2adcbbe9ab2f',
  tartufo: '1552539618-7eec9b4d1796',
  rustica: '1594007654729-407eedc4be65',
  hawaiana: 'own:hawaiana',
  salami: 'own:salami',
  braulia: 'own:braulia',
  atunazo: 'own:atunazo',
  bacon: 'own:bacon',
  guiris: 'own:guiris',
  aTuGusto: 'own:a-tu-gusto',
  dulceDeCabra: 'own:dulce-de-cabra',
  kebabPizza: 'own:kebab',
  chatoYCabra: 'own:chato-y-cabra',
  mexicana: 'own:mexicana',
  marinera: 'own:marinera',
  trufada: 'own:trufada',
  carnivora: 'own:carnivora',
  carbonara: 'own:carbonara',
  iberica: 'own:iberica',
  laJefa: 'own:la-jefa',
  nonno: 'own:nonno',
  barbacoa: 'own:barbacoa',
  calzoneProsciutto: 'own:calzone-prosciutto',
  calzoneKebab: 'own:calzone-kebab',
  calzoneSerrano: 'own:calzone-serrano',
  calzoneOreo: 'own:calzone-oreo',
  calzoneTostarica: 'own:calzone-tostarica',
  calzonePistacho: 'own:calzone-pistacho',
  calzoneLotus: 'own:calzone-lotus',
  nonnitosLotus: 'own:nonnitos-lotus',
  nonnitosNutella: 'own:nonnitos-nutella',
  nonnitosPistacho: 'own:nonnitos-pistacho',
  nonnitosOreo: 'own:nonnitos-oreo',
  provolone: 'own:provolone',
  ovniCamembert: 'own:ovni-camembert',
  tirasPollo: 'own:tiras-pollo',

  // Entrantes
  panDeAjo: 'own:pan-de-ajo',
  ensalada: '1540189549336-e6e99c3679fe',
  alitas: 'own:alitas',
  patatasCheeseBacon: 'own:patatas-cheese-bacon',
  patatasCheeseKebab: 'own:patatas-cheese-kebab',
  patatasFritas: 'own:patatas-fritas',
  boniatos: 'own:boniatos',
  nuggets: 'own:nuggets',
  tequenos: 'own:tequenos',
  palitosMozzarella: 'own:palitos-mozzarella',

  // Bebidas
  limonada: '1621263764928-df1444c5e859',
  zumo: '1600271886742-f049cd451bba',
  vino: '1437418747212-8d9709afab22',
  cafe: '1544787219-7f47ccb76574',
  refrescoBote: 'own:refresco-bote',
  aguaBotella: 'own:agua',
  cervezaBotella: 'own:cerveza',
  colaBotella: 'own:coca-cola-2l',

  // Postres
  tarta: '1571877227200-a0d98ea607e9',
  pannaCotta: '1488477181946-6428a0291777',
  helado: '1551024506-0bccd828d307',
  cookies: '1499636136210-6f4ee915583e',
  oreoDessert: '1623548694299-c3eb13a26c5b',
  nutellaCrepe: '1515467837915-15c4777ba46a',
  pistachoDessert: '1482930172332-2293d7138235',
  lotusDessert: '1771220433638-173b9579d199',
}
