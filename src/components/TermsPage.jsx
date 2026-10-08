import { ArrowLeft, FileText, Scale, ShieldAlert, UtensilsCrossed } from 'lucide-react'
import { navigate } from '../lib/router'
import { useSiteContent } from '../hooks/useSiteContent'

const termsSections = [
  {
    icon: FileText,
    title: '1. Objeto y Titularidad del Servicio',
    content: `El presente sitio web y sus canales de pedido digital son operados bajo el nombre comercial "La Pizza de Nonno". Las presentes Condiciones Generales de Contratación regulan la solicitud de pedidos, recogida en tienda física y reparto a domicilio en las sedes operativas de Sangonera la Verde y Santo Ángel (Región de Murcia).

Al confirmar un pedido a través de este sitio web, por mostrador o por vía telefónica, el cliente manifiesta ser mayor de edad o contar con capacidad legal para contratar, y acepta de forma plena y sin reservas las presentes condiciones.`,
  },
  {
    icon: UtensilsCrossed,
    title: '2. Proceso de Pedido y Asignación de Franja Horaria',
    content: `Los pedidos se confeccionan de forma artesanal y personalizada al momento.
• Elección de Sede: El cliente selecciona la sede correspondiente según su ubicación o preferencia de recogida.
• Capacidad de Cocina: Cada sede cuenta con una capacidad límite de horneado por tramo horario. El sistema calcula y asigna automáticamente una hora estimada de recogida o de entrega (ETA).
• Modificaciones o Rechazos: En situaciones de alta demanda o falta de existencias de masa fresca del día, el establecimiento se reserva el derecho de no admitir nuevos pedidos para garantizar los estándares de calidad y seguridad alimentaria.`,
  },
  {
    icon: Scale,
    title: '3. Precios, Tasas e Información Alimentaria',
    content: `• Precios e IVA: Todos los precios mostrados en la carta digital incluyen el Impuesto sobre el Valor Añadido (IVA) legalmente aplicable en España.
• Gastos de Reparto: Los pedidos a domicilio están sujetos a suplementos de entrega calculados en base a la distancia kilométrica y tramos de reparto autorizados desde el obrador.
• Alérgenos e Intolerancias: La información sobre los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011) se encuentra detallada en la sección pública /alergenos. Si usted padece una alergia severa o celiaquía con riesgo de contaminación cruzada por trazas aéreas de harina de trigo, le rogamos se ponga en contacto telefónico previo con el personal del local antes de tramitar el pedido.`,
  },
  {
    icon: Scale,
    title: '4. Modalidad de Pago',
    content: `• No se realiza cobro por adelantado con pasarela bancaria en la web.
• Los importes se abonan directamente en el establecimiento (en pedidos de recogida) o al repartidor asignado en el domicilio de entrega.
• Métodos admitidos: Efectivo y tarjeta de débito/crédito mediante TPV móvil en el momento de la entrega o retirada.`,
  },
  {
    icon: ShieldAlert,
    title: '5. Derecho de Desistimiento y Cancelaciones',
    content: `• EXCEPCIÓN AL DERECHO DE DESISTIMIENTO: De conformidad con el artículo 103, letra d) del Real Decreto Legislativo 1/2007 (Ley General para la Defensa de los Consumidores y Usuarios - TRLGDCU), NO APLICA el derecho legal de desistimiento de 14 días al suministro de bienes que puedan deteriorarse o caducar con rapidez, tales como alimentos preparados y cocinados para consumo inmediato.
• Cancelaciones previas: El cliente podrá cancelar o modificar un pedido sin coste únicamente si se comunica telefónicamente con el local antes de que el pedido haya entrado al horno o haya sido asignado a un repartidor para su despacho. Si el producto ya ha sido elaborado o despachado, el cliente queda obligado al pago íntegro del mismo.`,
  },
  {
    icon: FileText,
    title: '6. Programa de Fidelidad (Club Nonno)',
    content: `• La acumulación de puntos se genera con pedidos no cancelados conforme a las reglas del programa.
• Los puntos son personales, intransferibles y no canjeables por dinero en metálico ni transferibles a terceras personas.
• El establecimiento se reserva el derecho de auditar y corregir saldos en caso de cancelaciones, devoluciones o uso fraudulento del sistema.`,
  },
  {
    icon: Scale,
    title: '7. Legislación Aplicable y Jurisdicción',
    content: `Las presentes condiciones se rigen en todos sus extremos por la legislación española. De conformidad con el Reglamento (UE) 524/2013, se informa al consumidor de la existencia de la plataforma de resolución de litigios en línea de la Unión Europea: https://ec.europa.eu/consumers/odr.

Para cualquier controversia que no pueda resolverse de forma amistosa, las partes se someten a los Juzgados y Tribunales que correspondan conforme a la legislación de consumidores aplicable.`,
  },
]

export default function TermsPage() {
  const { privacy } = useSiteContent()

  return (
    <main className="shell min-h-[60vh] py-10 sm:py-16">
      <button
        onClick={() => navigate('/')}
        className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-tomate hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Nonno
      </button>

      <header className="mx-auto mt-8 max-w-3xl text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border-2 border-tomate bg-crema text-tomate shadow-[2px_2px_0_0_rgb(var(--c-tomate))]">
          <Scale className="h-7 w-7" />
        </span>
        <p className="mono mt-4 text-tomate">Condiciones de Contratación</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-tomate sm:text-5xl">
          Términos de Servicio
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-carbon/75">
          Condiciones aplicables a los pedidos, recogida, reparto a domicilio y uso de la plataforma de La Pizza de Nonno.
        </p>
      </header>

      <div className="mx-auto mt-9 max-w-3xl space-y-4">
        {termsSections.map((section, idx) => {
          const Icon = section.icon
          return (
            <section key={idx} className="pframe bg-crema">
              <div className="pframe-in p-5 sm:p-6">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-5 w-5 text-tomate shrink-0" />
                  <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                    {section.title}
                  </h2>
                </div>
                <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-carbon/80">
                  {section.content}
                </div>
              </div>
            </section>
          )
        })}

        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6 text-center">
            <h2 className="font-sans text-sm font-extrabold uppercase text-tomate">
              ¿Dudas sobre tu pedido o estas condiciones?
            </h2>
            <p className="mt-1 text-sm text-carbon/75">
              Contacta directamente con la sede de tu pedido o escríbenos a{' '}
              {privacy?.email ? (
                <a className="font-semibold text-tomate underline" href={`mailto:${privacy.email}`}>
                  {privacy.email}
                </a>
              ) : (
                'nuestro canal de atención al cliente'
              )}
              .
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}
