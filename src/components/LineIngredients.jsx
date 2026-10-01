/**
 * Lo que se quita (rojo) y lo que se añade (verde) a una línea del
 * pedido, con el mismo grosor para que se lea igual y un "+" delante
 * de cada extra. `className` da el tamaño y la letra de cada sitio.
 */
export default function LineIngredients({ removed = [], extras = [], className = '' }) {
  return (
    <>
      {removed.length > 0 && (
        <span className={`block ing-sin ${className}`}>Sin {removed.join(', sin ')}</span>
      )}
      {extras.length > 0 && (
        <span className={`block ing-mas ${className}`}>{extras.map((e) => `+ ${e}`).join(', ')}</span>
      )}
    </>
  )
}
