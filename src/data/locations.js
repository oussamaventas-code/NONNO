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

    // DATOS DE LA CARTA
    address: 'C. Mayor 1, Sangonera la Verde, Murcia',
    phones: ['611 98 18 08', '611 98 18 25'],
    /* Plan B: si la web no puede enviar un pedido, se ofrece mandarlo
       por WhatsApp ya escrito a este número, o llamar.
       TODO: CONFIRMAR QUE ESTE NÚMERO TIENE WHATSAPP. */
    whatsapp: '34611981808',
    hours: 'De jueves a domingo y festivos, de 19:00 a 23:00',
    mapsUrl: null, // TODO
    orderUrl: null, // TODO (pideme.net u otra plataforma)

    /* Envío por distancia en línea recta desde el local:
       hasta 1 km 1,50 €, de 1 a 3 km 3 €. Más lejos no se reparte.
       minutes: reparto desde que sale del horno (TODO: CONFIRMAR).
       origin: TODO poner el punto exacto del local si difiere. */
    delivery: {
      origin: { lat: 37.9314349, lng: -1.2125326 },
      tiers: [
        { upToKm: 1, fee: 1.5, minutes: 10 },
        { upToKm: 3, fee: 3, minutes: 20 },
      ],
      /* Organizador de rutas. TODO: CONFIRMAR CON NONNO.
         maxStops: pedidos por salida del repartidor
         groupWindowMin: pedidos listos con esta diferencia pueden ir juntos
         nearKm: distancia máxima entre paradas de una misma salida
         speedKmh / stopMinutes: para estimar la hora de llegada a cada casa */
      routing: { maxStops: 4, groupWindowMin: 10, nearKm: 1.5, speedKmh: 25, stopMinutes: 3 },
    },

    /* Horno: de jueves a domingo y festivos, 19:00–23:00 (carta).
       Qué días se abre lo decide el interruptor del panel. */
    kitchen: { open: '19:00', close: '23:00', slotMinutes: 15, pizzasPerSlot: 15 },

    deliveryNote:
      'Envío 1,50 € hasta 1 km y 3 € hasta 3 km del local. Las ofertas "Llévatelas por menos" son solo para recoger.',
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
    phones: [], // TODO
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
