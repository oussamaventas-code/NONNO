import { ArrowLeft, ShieldCheck, Lock, UserCheck, Database, Cookie, Mail } from 'lucide-react'
import { useSiteContent } from '../hooks/useSiteContent'
import { navigate } from '../lib/router'

export default function PrivacyPage() {
  const { privacy } = useSiteContent()
  const legalReady = Boolean(
    privacy?.controllerName && privacy?.address && privacy?.email
    && privacy?.legalBasis && privacy?.recipients && privacy?.retention
  )

  const controller = privacy?.controllerName || 'La Pizza de Nonno S.L. (o titular de la explotación artesanal)'
  const address = privacy?.address || 'Sedes en Sangonera la Verde y Santo Ángel, Murcia (España)'
  const contactEmail = privacy?.email || 'contacto@lapizzadenonno.com'

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
          <ShieldCheck className="h-7 w-7" />
        </span>
        <p className="mono mt-4 text-tomate">Cumplimiento RGPD y LOPDGDD</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold text-tomate sm:text-5xl">
          Política de Privacidad y Cookies
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-carbon/75">
          Información clara y transparente sobre el tratamiento de tus datos personales, tus derechos y el uso de almacenamiento técnico.
        </p>
      </header>

      <div className="mx-auto mt-9 max-w-3xl space-y-4">
        {!legalReady && (
          <div className="rounded-lg border border-horno/70 bg-queso/60 p-4 text-sm leading-relaxed text-carbon">
            <strong>Nota para la administración:</strong> Algunos datos identificativos específicos del responsable pueden completarse o editarse desde el panel de Superadministración.
          </div>
        )}

        {/* 1. Responsable del Tratamiento */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <UserCheck className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                1. Responsable del Tratamiento
              </h2>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-carbon/80 space-y-1.5">
              <p><strong>Identidad:</strong> {controller} {privacy?.legalId ? `(NIF/CIF: ${privacy.legalId})` : ''}</p>
              <p><strong>Domicilio:</strong> {address}</p>
              <p>
                <strong>Contacto de Privacidad:</strong>{' '}
                <a className="font-semibold text-tomate underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* 2. Datos recopilados y Finalidades */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Database className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                2. Qué datos recopilamos y para qué
              </h2>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-carbon/80 space-y-2">
              <p>Tratamos las siguientes categorías de datos con las finalidades expresas:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Gestión y preparación de pedidos:</strong> Nombre, teléfono de contacto, sede elegida, productos y notas de elaboración. En caso de entrega a domicilio, se recaba la dirección postal y coordenadas de geolocalización aproximadas.
                </li>
                <li>
                  <strong>Seguimiento y notificaciones transaccionales:</strong> Aviso de estado del pedido (recibido, en horno, listo para recoger o en reparto) a través de SMS transaccional o correo electrónico.
                </li>
                <li>
                  <strong>Programa de fidelidad (Club Nonno):</strong> Historial de pedidos vinculados a tu cuenta y saldo acumulado de puntos.
                </li>
                <li>
                  <strong>Comunicaciones comerciales y promociones:</strong> Solo si has marcado expresamente la casilla de consentimiento (marketing_ok).
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 3. Base Jurídica de Legitimación */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                3. Base Jurídica del Tratamiento
              </h2>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-carbon/80 space-y-1.5">
              <p>• <strong>Ejecución del contrato (Art. 6.1.b RGPD):</strong> Necesario para procesar, elaborar, facturar y entregar tus pedidos de pizza.</p>
              <p>• <strong>Obligación legal (Art. 6.1.c RGPD):</strong> Conservación de datos para el cumplimiento de obligaciones tributarias, contables y sanitarias.</p>
              <p>• <strong>Consentimiento expreso (Art. 6.1.a RGPD):</strong> Para el envío de boletines de ofertas, comunicaciones de marketing y el registro opcional en el Club Nonno.</p>
            </div>
          </div>
        </section>

        {/* 4. Destinatarios y Proveedores */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Database className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                4. Destinatarios y Encargados de Tratamiento
              </h2>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-carbon/80 space-y-2">
              <p>
                No cedemos tus datos personales a terceros con fines comerciales ni publicitarios.
                Para prestar el servicio digital, contratamos con proveedores tecnológicos que actúan como Encargados del Tratamiento bajo acuerdos conformes al Art. 28 del RGPD:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Alojamiento e infraestructura web:</strong> Vercel Inc. (servidores en la Unión Europea).</li>
                <li><strong>Base de datos y gestión de acceso:</strong> Supabase Inc. (región UE - Fráncfort).</li>
                <li><strong>Mensajería y notificaciones:</strong> Proveedores de mensajería SMS y transporte SMTP para el envío de tickets y avisos de estado.</li>
                <li><strong>Repartidores autorizados:</strong> Personal propio de la sede asignada que accede temporalmente a la dirección y teléfono para la entrega física.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 5. Plazos de Conservación */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Lock className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                5. Plazos de Conservación de Datos
              </h2>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-carbon/80">
              {privacy?.retention || 'Los datos relativos a los pedidos se conservarán durante los plazos legalmente exigidos por la normativa tributaria y mercantil española (4 a 6 años). Los datos vinculados a cuentas de usuario del Club Nonno se mantendrán activos mientras no solicites la supresión de tu cuenta.'}
            </p>
          </div>
        </section>

        {/* 6. Derechos del Usuario */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                6. Tus Derechos (ARCO-POL)
              </h2>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-carbon/80 space-y-2">
              <p>Puedes ejercer en cualquier momento tus derechos de:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Acceso:</strong> Conocer qué datos tuyos estamos tratando.</li>
                <li><strong>Rectificación:</strong> Modificar datos inexactos o incompletos.</li>
                <li><strong>Supresión:</strong> Solicitar la eliminación de tus datos cuando ya no sean necesarios.</li>
                <li><strong>Oposición y Limitación:</strong> Oponerte al tratamiento o solicitar la limitación del mismo.</li>
                <li><strong>Portabilidad:</strong> Obtener tus datos en formato estructurado y de lectura mecánica.</li>
              </ul>
              <p className="pt-1">
                Para ejercerlos, remite una solicitud por escrito acreditando tu identidad al correo{' '}
                <a className="font-semibold text-tomate underline" href={`mailto:${contactEmail}`}>
                  {contactEmail}
                </a>. Asimismo, si consideras que tus derechos no han sido debidamente atendidos, tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en{' '}
                <a className="font-semibold text-tomate underline" href="https://www.aepd.es" target="_blank" rel="noopener noreferrer">
                  www.aepd.es
                </a>.
              </p>
            </div>
          </div>
        </section>

        {/* 7. Política de Cookies y Almacenamiento Local */}
        <section className="pframe bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <Cookie className="h-5 w-5 text-tomate shrink-0" />
              <h2 className="font-sans text-base font-extrabold uppercase text-tomate">
                7. Cookies y Almacenamiento Técnico
              </h2>
            </div>
            <div className="mt-3 text-sm leading-relaxed text-carbon/80 space-y-2">
              <p>
                Este sitio web utiliza cookies y mecanismos de almacenamiento local en estricto cumplimiento con la Directiva ePrivacy y la Guía de Cookies de la AEPD:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>
                  <strong>Cookies Técnicas / Esenciales (Exentas de consentimiento):</strong> Almacenan de forma imprescindible tu carrito de la compra, la sede seleccionada (Sangonera la Verde o Santo Ángel), tu sesión autenticada en el panel o en tu cuenta, y la preferencia de cookies guardada.
                </li>
                <li>
                  <strong>Cookies Analíticas o de Marketing:</strong> No cargamos rastreadores de terceros ni píxeles de publicidad invasiva. Si se añadiese analítica opcional, se mantendrá bloqueada por defecto hasta que otorgues tu consentimiento expreso mediante el banner de cookies.
                </li>
              </ul>
              <p className="pt-2">
                Puedes volver a abrir la configuración de cookies en cualquier momento pulsando en "Configurar cookies" en el pie de página de la web.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
