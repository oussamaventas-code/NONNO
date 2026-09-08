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
export const img = (id, w = 1200, q = 72) =>
  `${UNSPLASH}${id}?w=${w}&q=${q}&auto=format&fit=crop`

/** srcSet responsive para las imágenes grandes (hero, editorial, destacado) */
export const srcSet = (id, widths = [640, 960, 1400, 1920]) =>
  widths.map((w) => `${img(id, w)} ${w}w`).join(', ')

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

  // Entrantes
  panDeAjo: '1608198093002-ad4e005484ec',
  ensalada: '1540189549336-e6e99c3679fe',
  alitas: '1580217593608-61931cefc821',

  // Bebidas
  limonada: '1621263764928-df1444c5e859',
  zumo: '1600271886742-f049cd451bba',
  vino: '1437418747212-8d9709afab22',
  cafe: '1544787219-7f47ccb76574',

  // Postres
  tarta: '1571877227200-a0d98ea607e9',
  pannaCotta: '1488477181946-6428a0291777',
  helado: '1551024506-0bccd828d307',
  cookies: '1499636136210-6f4ee915583e',
}
