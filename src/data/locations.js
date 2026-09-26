import { PHOTO } from './images.js'

/* ═══════════════════════════════════════════════════════════════
   SEDES

   ⚠️ DISTINCIÓN IMPORTANTE
   `verified: true`  → dato proporcionado (nombre, valoración, reseñas,
                       servicios indicados).
   `null`            → dato NO proporcionado. No se inventa: la UI oculta
                       el campo mientras siga a null.

   Las valoraciones y el número de reseñas son los indicados en el
   briefing y pueden variar con el tiempo.
   TODO: REEMPLAZAR CON INFORMACIÓN OFICIAL (dirección, teléfono,
   horarios, condiciones de entrega y enlace de pedido).
   ═══════════════════════════════════════════════════════════════ */

export const LOCATIONS = [
  {
    id: 'sangonera',
    code: 'NN—01',
    name: 'Sangonera la Verde',
    fullName: 'LA PIZZA DE NONNO — Sangonera la Verde',
    tagline: 'Entrega de pizza',
    image: PHOTO.venueSangonera,

    // DATOS PROPORCIONADOS
    rating: 4.9,
    reviews: 179,
    verified: true,

    /* Servicios indicados para esta sede: llevar y entrega */
    services: { pickup: true, delivery: true },

    // DATOS NO PROPORCIONADOS — la UI los oculta mientras sean null
    address: null, // TODO
    phone: null, // TODO
    whatsapp: null, // TODO
    hours: null, // TODO
    mapsUrl: null, // TODO
    orderUrl: null, // TODO (pideme.net u otra plataforma)

    /* Zonas de reparto y su coste, tal y como vienen en la carta.
       Fuera de estas zonas no se hace entrega. */
    /* minutes: tiempo de reparto desde que sale del horno.
       TODO: CONFIRMAR CON NONNO LOS MINUTOS REALES DE CADA ZONA. */
    deliveryZones: [
      { id: 'sangonera-la-verde', name: 'Sangonera la Verde', fee: 1.5, minutes: 10 },
      { id: 'el-palmar', name: 'El Palmar', fee: 3, minutes: 20 },
      { id: 'torreguil', name: 'Torreguil', fee: 3, minutes: 20 },
      { id: 'alcantarilla', name: 'Alcantarilla', fee: 3, minutes: 20 },
      { id: 'san-gines', name: 'San Ginés', fee: 3, minutes: 20 },
      { id: 'la-alberca', name: 'La Alberca', fee: 3, minutes: 25 },
    ],

    /* Horno: de jueves a domingo y festivos, 19:00–23:00 (carta).
       Qué días se abre lo decide el interruptor del panel. */
    kitchen: { open: '19:00', close: '23:00', slotMinutes: 15, pizzasPerSlot: 15 },

    deliveryNote:
      'Envío +1,50 € en Sangonera la Verde y +3 € en El Palmar, Torreguil, Alcantarilla, San Ginés y La Alberca. Las ofertas "Llévatelas por menos" son solo para recoger.',
  },
  {
    id: 'santo-angel',
    code: 'NN—02',
    name: 'Santo Ángel',
    fullName: 'LA PIZZA DE NONNO Santo Ángel',
    tagline: 'Pizza',
    image: PHOTO.venueSantoAngel,

    // DATOS PROPORCIONADOS
    rating: 5.0,
    reviews: 33,
    verified: true,

    /* Para esta sede solo consta la categoría "Pizza": no se afirma
       entrega a domicilio. Recogida activada como opción por defecto.
       TODO: CONFIRMAR SERVICIOS REALES DE ESTA SEDE. */
    services: { pickup: true, delivery: false },

    /* TODO: CONFIRMAR HORARIO Y CAPACIDAD DE ESTA SEDE (se asume la misma). */
    kitchen: { open: '19:00', close: '23:00', slotMinutes: 15, pizzasPerSlot: 15 },

    address: null, // TODO
    phone: null, // TODO
    whatsapp: null, // TODO
    hours: null, // TODO
    mapsUrl: null, // TODO
    orderUrl: null, // TODO

    deliveryNote:
      'Las opciones disponibles pueden variar según la sede y el horario.',
  },
]

export const getLocation = (id) => LOCATIONS.find((l) => l.id === id) || null

export const getDeliveryZone = (locationId, zoneId) =>
  getLocation(locationId)?.deliveryZones?.find((z) => z.id === zoneId) || null

/** Modos de pedido disponibles en una sede (nunca se asume simetría) */
export const availableModes = (locationId) => {
  const loc = getLocation(locationId)
  if (!loc) return []
  return [
    loc.services.pickup && { id: 'pickup', label: 'RECOGER', hint: 'La recoges tú en la sede' },
    loc.services.delivery && { id: 'delivery', label: 'ENTREGA', hint: 'Te la llevamos a casa' },
  ].filter(Boolean)
}
