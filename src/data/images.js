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
  venueSangonera: '1574071318508-1cdbab80d002',
  venueSantoAngel: '1590534247854-e97d5e3feef6',

  // Pizzas
  margherita: '1595854341625-f33ee10dbf94',
  diavola: '1534308983496-4fabb1a015ee',
  prosciutto: '1600628421055-4d30de868b8f',
  formaggi: '1548369937-47519962c11a',
  vegetale: '1593560708920-61dd98c46a4e',
  speciale: '1574071318508-1cdbab80d002',
  funghi: '1613564834361-9436948817d1',
  bufala: '1565299624946-b28f40a0ae38',
  bianca: '1571997478779-2adcbbe9ab2f',
  tartufo: '1552539618-7eec9b4d1796',
  rustica: '1594007654729-407eedc4be65',
  hawaiana: '1597715469889-dd75fe4a1765',
  salami: '1628840042765-356cda07504e',
  braulia: '1692737580563-7ba2d896f0f6', // jamón y champiñón
  atunazo: '1632641730239-fd127af7d679',
  bacon: '1782402481918-3f558edff05e',
  guiris: '1627819873302-998f1bdaa562', // huevo y champiñón
  dulceDeCabra: '1627461985459-51600559fffe',
  kebabPizza: '1644648965270-55f11e0d7709',
  chatoYCabra: '1584782930656-e2bc1e803fc7',
  mexicana: '1657799831232-e9548089a643',
  marinera: 'own:marinera',
  trufada: 'own:trufada',
  carnivora: 'own:carnivora',
  carbonara: 'own:carbonara',
  iberica: 'own:iberica',
  barbacoa: '1734769484424-36b99dd84818',
  calzone: '1753656681797-3234c89d6d4d',

  // Entrantes
  panDeAjo: '1608198093002-ad4e005484ec',
  ensalada: '1540189549336-e6e99c3679fe',
  alitas: '1580217593608-61931cefc821',
  patatasCheeseBacon: '1743193711514-4f7bc5d78d4d',
  patatasCheeseKebab: '1762284513031-3d7ad15562bc',
  patatasFritas: '1606755456206-b25206cde27e',
  boniatos: '1745792714512-77cffdb16020',
  nuggets: '1627662055487-551888db3aa8',
  tequenos: '1778850855907-8fbf7b089621',
  palitosMozzarella: '1778449665117-2c607bbc7415',

  // Bebidas
  limonada: '1621263764928-df1444c5e859',
  zumo: '1600271886742-f049cd451bba',
  vino: '1437418747212-8d9709afab22',
  cafe: '1544787219-7f47ccb76574',
  refrescoBote: '1554866585-cd94860890b7',
  aguaBotella: '1523362628745-0c100150b504',
  cervezaBotella: '1597822738124-151fb72dcb79',
  colaBotella: '1648569883125-d01072540b4c',

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
