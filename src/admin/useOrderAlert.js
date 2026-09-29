import { useCallback, useEffect, useRef, useState } from 'react'

/* ═══════════════════════════════════════════════════════════════
   Aviso sonoro de pedido nuevo.

   Se genera con WebAudio en lugar de un fichero de sonido: no hay
   descarga que pueda fallar ni fichero que se pierda en un
   despliegue. Son tres campanadas cortas, audibles en una cocina.

   Los navegadores no dejan sonar nada hasta que alguien interactúa
   con la página; por eso el contexto se desbloquea con el primer
   clic (el del propio login, normalmente).
   ═══════════════════════════════════════════════════════════════ */

export function useOrderAlert() {
  const ctxRef = useRef(null)
  /* ¿Puede sonar ya? El panel avisa si no, para que nadie se quede sin alarma. */
  const [ready, setReady] = useState(false)

  const unlock = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return
      ctxRef.current = new Ctx()
    }
    const ctx = ctxRef.current
    if (ctx.state === 'suspended') ctx.resume().then(() => setReady(ctx.state === 'running')).catch(() => {})
    else setReady(ctx.state === 'running')
  }, [])

  useEffect(() => {
    const onFirstInput = () => unlock()
    window.addEventListener('pointerdown', onFirstInput, { once: true })
    window.addEventListener('keydown', onFirstInput, { once: true })
    return () => {
      window.removeEventListener('pointerdown', onFirstInput)
      window.removeEventListener('keydown', onFirstInput)
    }
  }, [unlock])

  useEffect(() => () => { ctxRef.current?.close?.() }, [])

  const play = useCallback(() => {
    unlock()
    const ctx = ctxRef.current
    if (!ctx || ctx.state !== 'running') return

    // Tres campanadas ascendentes, medio segundo en total
    ;[0, 0.18, 0.36].forEach((offset, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const at = ctx.currentTime + offset

      osc.type = 'sine'
      osc.frequency.setValueAtTime([880, 1108, 1318][i], at)

      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.35, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)

      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.18)
    })
  }, [unlock])

  return { play, unlock, ready }
}
