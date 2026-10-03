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

    // DATOS PROPORCIONADOS (ficha de Google del local)
    rating: 4.9,
    reviews: 182,
    verified: true,

    /* Servicios indicados para esta sede: llevar y entrega */
    services: { pickup: true, delivery: true },

    // DATOS DE LA CARTA
    address: 'C. Mayor 1, 30833 Sangonera la Verde, Murcia',
    /* Punto físico del local: para saber qué sede está más cerca del
       cliente (por eso vive aquí y no solo dentro de `delivery`). */
    coords: { lat: 37.9314349, lng: -1.2125326 },
    phones: ['611 98 18 08'],
    /* Plan B: si la web no puede enviar un pedido, se ofrece mandarlo
       por WhatsApp ya escrito a este número, o llamar.
       TODO: CONFIRMAR QUE ESTE NÚMERO TIENE WHATSAPP. */
    whatsapp: '34611981808',
    hours: 'De jueves a domingo y festivos, de 19:00 a 23:00.',
    mapsUrl: null, // TODO
    orderUrl: null, // TODO (enlace exacto de pideme.net de esta sede)

    /* Envío por distancia en línea recta desde el local:
       hasta 1 km 1,50 €, de 1 a 3 km 3 €, de 3 a 4 km 3,50 €
       (TODO: CONFIRMAR precio y minutos del último tramo). Más lejos
       no se reparte. Con 4 km las dos sedes cubren todo El Palmar;
       cada dirección va a la sede más cercana (ver deliveryQuote).
       minutes: reparto desde que sale del horno (TODO: CONFIRMAR).
       origin: TODO poner el punto exacto del local si difiere. */
    delivery: {
      origin: { lat: 37.9314349, lng: -1.2125326 },
      tiers: [
        { upToKm: 1, fee: 1.5, minutes: 10 },
        { upToKm: 3, fee: 3, minutes: 20 },
        { upToKm: 4, fee: 3.5, minutes: 25 },
      ],
      /* Organizador de rutas. TODO: CONFIRMAR CON NONNO.
         maxStops: pedidos por salida del repartidor
         groupWindowMin: pedidos listos con esta diferencia pueden ir juntos
         nearKm: distancia máxima entre paradas de una misma salida
         speedKmh / stopMinutes: para estimar la hora de llegada a cada casa */
      routing: { maxStops: 4, groupWindowMin: 10, nearKm: 1.5, speedKmh: 25, stopMinutes: 3 },
    },

    /* Horno: de 19:00 a 23:00 (carta impresa). Qué días se abre lo
       decide el interruptor del panel; `closeByDay` permite cerrar
       antes un día concreto si algún día hiciera falta. */
    /* manual: la cocina abre y cierra SOLO con el botón del panel
       (open/close quedan como referencia; sin `manual` volverían a mandar). */
    /* Tramos de 15 min con 15 pizzas: un pedido entra en el tramo en marcha
       mientras queden huecos (pide 20:01 o 20:10 → listo 20:15); si está
       lleno, lo que no cabe pasa al siguiente. minMinutes: minutos que le
       tienen que quedar al tramo para entrar en él (0 = siempre). */
    kitchen: { manual: true, open: '19:00', close: '23:00', slotMinutes: 15, pizzasPerSlot: 15, minMinutes: 0 },

    deliveryNote:
      'Envío 1,50 € hasta 1 km, 3 € hasta 3 km y 3,50 € hasta 4 km del local. Las ofertas "Llévatelas por menos" son solo para recoger.',
  },
  {
    id: 'santo-angel',
    code: 'NN—02',
    name: 'Santo Ángel',
    fullName: 'LA PIZZA DE NONNO Santo Ángel',
    tagline: 'Pizza',
    image: PHOTO.venueSantoAngel,

    // DATOS PROPORCIONADOS (ficha de Google del local)
    rating: 5.0,
    reviews: 59,
    verified: true,

    /* Ficha de Google muestra "Pedir para llevar" y "Pedir a domicilio". */
    services: { pickup: true, delivery: true },

    /* Jueves a domingo y festivos, 19:00–23:00 (carta impresa). */
    /* manual: la cocina abre y cierra SOLO con el botón del panel
       (open/close quedan como referencia; sin `manual` volverían a mandar). */
    /* Tramos de 15 min con 15 pizzas: un pedido entra en el tramo en marcha
       mientras queden huecos (pide 20:01 o 20:10 → listo 20:15); si está
       lleno, lo que no cabe pasa al siguiente. minMinutes: minutos que le
       tienen que quedar al tramo para entrar en él (0 = siempre). */
    kitchen: { manual: true, open: '19:00', close: '23:00', slotMinutes: 15, pizzasPerSlot: 15, minMinutes: 0 },

    address: 'C. Isaac Peral 2, 30151 Santo Ángel, Murcia',
    /* Geocodificado a partir de la dirección real (calle, sin poder
       precisar el número exacto). TODO: AJUSTAR SI EL PUNTO NO
       COINCIDE CON LA PUERTA DEL LOCAL. */
    coords: { lat: 37.9410779, lng: -1.1300820 },
    phones: ['611 98 18 25'],
    /* Plan B por WhatsApp, igual que Sangonera.
       TODO: CONFIRMAR QUE ESTE NÚMERO TIENE WHATSAPP. */
    whatsapp: '34611981825',
    hours: 'De jueves a domingo y festivos, de 19:00 a 23:00.',
    mapsUrl: null, // TODO
    orderUrl: null, // TODO (enlace exacto de pideme.net de esta sede)

    /* Envío por distancia: se asume la misma tarifa que Sangonera.
       TODO: CONFIRMAR CON NONNO SI ESTA SEDE TIENE SU PROPIA TARIFA. */
    delivery: {
      origin: { lat: 37.9410779, lng: -1.1300820 },
      tiers: [
        { upToKm: 1, fee: 1.5, minutes: 10 },
        { upToKm: 3, fee: 3, minutes: 20 },
        { upToKm: 4, fee: 3.5, minutes: 25 },
      ],
      routing: { maxStops: 4, groupWindowMin: 10, nearKm: 1.5, speedKmh: 25, stopMinutes: 3 },
    },

    deliveryNote:
      'Envío 1,50 € hasta 1 km, 3 € hasta 3 km y 3,50 € hasta 4 km del local. Las ofertas "Llévatelas por menos" son solo para recoger.',
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
