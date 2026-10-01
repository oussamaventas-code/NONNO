import { useEffect, useState } from 'react'
import { Smartphone, Share, PlusSquare, MoreVertical, X } from 'lucide-react'
import { installMode, promptInstall, dismissInstall, INSTALL_EVENT } from '../lib/installApp'

/* Tarjeta "Instala Nonno" en el seguimiento del pedido: con la app
   el cliente tiene su ticket a mano y la próxima vez pide en dos toques. */
export default function InstallApp() {
  const [mode, setMode] = useState(installMode)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const update = () => setMode(installMode())
    window.addEventListener(INSTALL_EVENT, update)
    return () => window.removeEventListener(INSTALL_EVENT, update)
  }, [])

  if (installed) {
    return (
      <p className="mt-6 text-center font-bold uppercase text-tomate">¡Listo! Ya tienes a Nonno en tu móvil</p>
    )
  }
  if (!mode) return null

  const install = async () => {
    if (await promptInstall()) setInstalled(true)
  }

  return (
    <div className="mt-6 frame">
      <div className="frame-in relative p-5">
        <button
          onClick={dismissInstall}
          className="absolute right-2 top-2 p-2 text-carbon/50 hover:text-carbon"
          aria-label="No quiero instalarla"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-4 pr-6">
          <img src="/app/icono-192.png" alt="" className="h-14 w-14 flex-shrink-0 rounded-xl" />
          <div>
            <p className="font-display italic font-bold text-2xl text-tomate leading-tight">Llévate a Nonno en el móvil</p>
            <p className="mt-1 text-sm text-carbon/75">
              Instala la app para no perder tu ticket, ver cuándo está listo y pedir más rápido la próxima vez.
            </p>
          </div>
        </div>

        {mode === 'prompt' && (
          <button onClick={install} className="btn-retro mt-4 w-full">
            <span className="flex items-center justify-center gap-2"><Smartphone className="w-4 h-4" /> Instalar la app</span>
          </button>
        )}

        {mode === 'ios' && (
          <ol className="mt-4 flex flex-col gap-2 text-sm text-carbon">
            <li className="flex items-center gap-2">
              <span className="mono text-tomate">1</span> Toca <Share className="w-4 h-4 text-tomate" aria-label="Compartir" /> <strong>Compartir</strong> en la barra del navegador
            </li>
            <li className="flex items-center gap-2">
              <span className="mono text-tomate">2</span> Elige <PlusSquare className="w-4 h-4 text-tomate" /> <strong>Añadir a pantalla de inicio</strong>
            </li>
            <li className="flex items-center gap-2">
              <span className="mono text-tomate">3</span> Pulsa <strong>Añadir</strong>: el icono de Nonno abre tu ticket
            </li>
          </ol>
        )}

        {mode === 'manual' && (
          <p className="mt-4 flex flex-wrap items-center gap-1 text-sm text-carbon">
            Abre el menú <MoreVertical className="w-4 h-4 text-tomate" aria-label="menú" /> del navegador y elige <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.
          </p>
        )}
      </div>
    </div>
  )
}
