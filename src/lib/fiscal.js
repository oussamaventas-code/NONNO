/* ═══════════════════════════════════════════════════════════════
   DATOS FISCALES DEL TICKET (factura simplificada)

   Hostelería: IVA del 10 %, ya incluido en los precios (también en el
   envío, que va con la comida). El ticket desglosa base e IVA.

   Las dos sedes son de la misma sociedad (mismo CIF y domicilio
   fiscal). Si una sede pone el NIF a null, su ticket deja de imprimir
   el bloque fiscal (sí el desglose del IVA).
   ═══════════════════════════════════════════════════════════════ */

const NOCARPIZZAS = {
  name: 'NOCARPIZZAS S.L.',
  nif: 'B22487224',
  address: 'C/ La Gloria 67 B, 30150 La Alberca (Murcia)',
}

const FISCAL = {
  sangonera: NOCARPIZZAS,
  'santo-angel': NOCARPIZZAS,
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
