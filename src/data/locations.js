import { PHOTO } from './images'

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

    /* Aviso mostrado en checkout cuando no hay condiciones oficiales */
    deliveryNote:
      'Las condiciones de entrega se confirman con la sede al procesar el pedido.',
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

/** Modos de pedido disponibles en una sede (nunca se asume simetría) */
export const availableModes = (locationId) => {
  const loc = getLocation(locationId)
  if (!loc) return []
  return [
    loc.services.pickup && { id: 'pickup', label: 'RECOGER', hint: 'La recoges tú en la sede' },
    loc.services.delivery && { id: 'delivery', label: 'ENTREGA', hint: 'Te la llevamos a casa' },
  ].filter(Boolean)
}
