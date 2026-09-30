/** Minúsculas y sin tildes, para buscar: "jamon" encuentra "Jamón cocido". */
export const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
