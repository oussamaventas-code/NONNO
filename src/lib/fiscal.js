/* ═══════════════════════════════════════════════════════════════
   DATOS FISCALES DEL TICKET (factura simplificada)

   Hostelería: IVA del 10 %, ya incluido en los precios (también en el
   envío, que va con la comida). El ticket desglosa base e IVA.

   TODO: rellenar con la documentación del dueño (razón social, NIF/CIF
   y domicilio fiscal de cada sede). Mientras el NIF esté a null, el
   ticket no imprime el bloque fiscal (sí el desglose del IVA).
   ═══════════════════════════════════════════════════════════════ */

const FISCAL = {
  sangonera: { name: null, nif: null, address: null },
  'santo-angel': { name: null, nif: null, address: null },
}

export const IVA_RATE = 10

/** Desglose de un total con IVA incluido, en euros redondeados al céntimo. */
export function vatOf(total) {
  const cents = Math.round((Number(total) || 0) * 100)
  const base = Math.round(cents / (1 + IVA_RATE / 100))
  return { base: base / 100, iva: (cents - base) / 100 }
}

/** Datos fiscales de la sede, o null si aún no están puestos. */
export const fiscalOf = (locationId) => (FISCAL[locationId]?.nif ? FISCAL[locationId] : null)
