import { useEffect, useState } from 'react'
import { Smartphone, Share, PlusSquare, MoreVertical, X } from 'lucide-react'
import { installMode, promptInstall, dismissInstall, INSTALL_EVENT } from '../lib/installApp'

/* "Instala Nonno": tarjeta en el seguimiento del pedido y, con `big`,
   paso a pantalla completa justo después de pedir (con "Ahora no",
   porque en iPhone Apple no deja instalar desde un botón). Con la app
   el cliente tiene su ticket a mano y la próxima vez pide en dos toques. */
export default function InstallApp({ big = false, onDone }) {
  const [mode, setMode] = useState(installMode)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const update = () => setMode(installMode())
    window.addEventListener(INSTALL_EVENT, update)
    return () => window.removeEventListener(INSTALL_EVENT, update)
  }, [])

  /* En la pantalla grande, si no hay nada que instalar se sigue sin más */
  useEffect(() => {
    if (big && !mode && !installed) onDone?.()
  }, [big, mode, installed, onDone])

  if (installed) {
    return (
      <div className={big ? 'py-8 text-center' : ''}>
        <p className="mt-6 text-center font-bold uppercase text-tomate">¡Listo! Ya tienes a Nonno en tu móvil</p>
        {big && <button onClick={onDone} className="btn-retro mt-6"><span>Seguir mi pedido</span></button>}
      </div>
    )
  }
  if (!mode) return null

  const install = async () => {
    if (await promptInstall()) setInstalled(true)
  }

  if (big) {
    return (
      <div className="py-4 text-center">
        <img src="/app/icono-192.png" alt="" className="mx-auto h-24 w-24 rounded-2xl shadow-lg" />
        <p className="mt-5 font-display italic font-bold text-3xl text-tomate leading-tight">Instala la app de Nonno</p>
        <p className="mt-3 text-carbon/75 max-w-xs mx-auto">
          Tu ticket siempre a mano, ver cuándo está listo tu pedido y pedir en dos toques la próxima vez.
        </p>
        {mode === 'prompt' && (
          <button onClick={install} className="btn-retro mt-6 w-full">
            <span className="flex items-center justify-center gap-2"><Smartphone className="w-5 h-5" /> INSTALAR LA APP</span>
          </button>
        )}
        {mode === 'ios' && <IosSteps big />}
        {mode === 'manual' && <ManualSteps big />}
        <button onClick={onDone} className="mt-6 text-sm text-carbon/50 underline underline-offset-4">Ahora no</button>
      </div>
    )
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

        {mode === 'ios' && <IosSteps />}
        {mode === 'manual' && <ManualSteps />}
      </div>
    </div>
  )
}

function IosSteps({ big }) {
  const step = big ? 'flex items-center gap-3 rounded-md border border-tomate/40 px-4 py-3 text-left' : 'flex items-center gap-2'
  return (
    <ol className={['mt-4 flex flex-col gap-2 text-carbon', big ? 'text-base' : 'text-sm'].join(' ')}>
      <li className={step}>
        <span className="mono text-tomate">1</span> <span>Toca <Share className="inline w-5 h-5 text-tomate align-text-bottom" aria-label="Compartir" /> <strong>Compartir</strong>, abajo en Safari</span>
      </li>
      <li className={step}>
        <span className="mono text-tomate">2</span> <span>Elige <PlusSquare className="inline w-5 h-5 text-tomate align-text-bottom" /> <strong>Añadir a pantalla de inicio</strong></span>
      </li>
      <li className={step}>
        <span className="mono text-tomate">3</span> <span>Pulsa <strong>Añadir</strong>: el icono de Nonno abre tu ticket</span>
      </li>
    </ol>
  )
}

function ManualSteps({ big }) {
  return (
    <p className={['mt-4 flex flex-wrap items-center justify-center gap-1 text-carbon', big ? 'text-base' : 'text-sm'].join(' ')}>
      Abre el menú <MoreVertical className="w-4 h-4 text-tomate" aria-label="menú" /> del navegador y elige <strong>Instalar app</strong> o <strong>Añadir a pantalla de inicio</strong>.
    </p>
  )
}
