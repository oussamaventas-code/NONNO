import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/* ═══════════════════════════════════════════════════════════════
   SISTEMA DE MOVIMIENTO
   Un único vocabulario de easings, duraciones y presets. Los
   componentes no inventan curvas: las consumen desde aquí.

   REGLA DE ORO
   ────────────
   El contenido NUNCA puede depender de que una animación termine
   para ser visible. `gsap.from()` pone opacity:0 al instante; si el
   navegador pausa requestAnimationFrame a mitad (pestaña en segundo
   plano, ahorro de energía de iOS, abrir el enlace desde otra app),
   la animación se congela y la sección se queda invisible para
   siempre. Por eso toda entrada pasa por `revealFrom` / `guard`,
   que garantizan el estado final pase lo que pase.
   ═══════════════════════════════════════════════════════════════ */

export const EASE = {
  in: 'power3.out',      // entradas
  morph: 'power2.inOut', // cambios de estado
  curtain: 'expo.inOut', // cortinas y paneles
}

export const DUR = {
  fast: 0.4,
  base: 0.9,
  slow: 1.2,
  cinematic: 1.8,
}

export const STAGGER = {
  text: 0.08,
  cards: 0.15,
}

/** ¿El usuario ha pedido menos movimiento? (iOS: Reducir movimiento) */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Duraciones por defecto de todo el sitio */
gsap.defaults({ ease: EASE.in, duration: DUR.base })

/* En móvil, mostrar u ocultar la barra del navegador dispara un
   resize que recalcularía todos los triggers a mitad de scroll. */
ScrollTrigger.config({ ignoreMobileResize: true })

/* ── Red de seguridad ───────────────────────────────────────────
   Toda animación de entrada se vigila. Si el reloj de animación se
   detiene y la deja a medias, la completamos en cuanto la página
   vuelve a estar visible o al agotarse el plazo máximo.            */

const RESCUE_MS = 4000
const watched = new Set()
const started = new WeakSet() // entradas cuyo ScrollTrigger ya disparó
const triggerEl = new WeakMap() // animación -> elemento que la dispara

const finish = (anim) => {
  if (!anim) return
  watched.delete(anim)
  if (anim.progress() < 1) anim.progress(1).kill()
}

/**
 * Vigila una animación de entrada.
 * @param {gsap.core.Animation} anim
 * @param {boolean} deferred  true si la dispara el scroll (entonces no
 *   se fuerza por tiempo: solo se rescata si quedó a medio camino).
 */
export function guard(anim, deferred = false) {
  if (!anim) return anim
  watched.add(anim)
  startSweep()

  const timer = deferred ? null : setTimeout(() => finish(anim), RESCUE_MS)
  const prev = anim.eventCallback('onComplete')

  anim.eventCallback('onComplete', function (...args) {
    if (timer) clearTimeout(timer)
    watched.delete(anim)
    if (prev) prev.apply(this, args)
  })

  return anim
}

/**
 * Completa lo que se quedó congelado.
 * Dos casos: la entrada que arrancó y se paró a mitad, y la sección
 * cuyo ScrollTrigger ya se disparó pero cuya animación nunca avanzó
 * (progreso 0) porque el reloj estaba detenido.
 */
const lastProgress = new WeakMap()

function rescueStalled() {
  watched.forEach((anim) => {
    const p = anim.progress()
    if (p >= 1) { watched.delete(anim); return }

    /* Ligada al scroll y todavía sin disparar: puede que simplemente no
       le toque aún, o que su sección ya esté en pantalla y el disparo
       nunca llegara (posiciones calculadas antes de cargar imágenes).
       Si el elemento ya está a la vista, la damos por buena. */
    if (anim.scrollTrigger && !started.has(anim)) {
      lastProgress.delete(anim)
      const el = triggerEl.get(anim)
      if (el && el.getBoundingClientRect().top < window.innerHeight * 0.9) finish(anim)
      return
    }

    /* No nos fiamos de isActive(): con el reloj detenido sigue
       devolviendo true. Si el progreso no se movió entre dos barridos,
       está congelada. */
    if (lastProgress.get(anim) === p) finish(anim)
    else lastProgress.set(anim, p)
  })
  if (!watched.size) stopSweep()
}

/* Barrido lento mientras queden entradas pendientes. Se apaga solo. */
let sweepId = null
function startSweep() {
  if (sweepId || typeof window === 'undefined') return
  sweepId = setInterval(rescueStalled, 2000)
}
function stopSweep() {
  if (sweepId) { clearInterval(sweepId); sweepId = null }
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(rescueStalled, 350)
  })
  window.addEventListener('pageshow', () => setTimeout(rescueStalled, 350))

  /* Las posiciones de los triggers se calculan antes de que carguen
     imágenes y fuentes: hay que recalcularlas cuando terminen. */
  window.addEventListener('load', () => ScrollTrigger.refresh())
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => ScrollTrigger.refresh())
  }
}

/**
 * Marca la animación en cuanto su ScrollTrigger entra en pantalla.
 * Con `once: true` el trigger se destruye tras dispararse y su
 * `progress` deja de ser fiable, así que lo anotamos nosotros.
 */
function armStart(vars, holder) {
  if (!vars.scrollTrigger) return vars
  const st = { ...vars.scrollTrigger }
  const prev = st.onEnter
  st.onEnter = (self) => {
    if (holder.anim) started.add(holder.anim)
    if (prev) prev(self)
  }
  holder.trigger = st.trigger
  return { ...vars, scrollTrigger: st }
}

/**
 * Entrada segura. Misma firma que `gsap.from`.
 * Con "reducir movimiento" activo no anima: deja el contenido visible.
 */
export function revealFrom(targets, vars = {}) {
  if (prefersReducedMotion()) {
    gsap.set(targets, { clearProps: 'all' })
    return null
  }
  const holder = {}
  const anim = gsap.from(targets, armStart(vars, holder))
  holder.anim = anim
  if (holder.trigger) triggerEl.set(anim, holder.trigger)
  return guard(anim, Boolean(vars.scrollTrigger))
}

/**
 * Timeline de entrada segura. Misma firma que `gsap.timeline`.
 * Devuelve null con "reducir movimiento": el componente debe tratarlo
 * como "no hay animación" y dejar el contenido tal cual.
 */
export function revealTimeline(vars = {}) {
  if (prefersReducedMotion()) return null
  const holder = {}
  const tl = gsap.timeline(armStart(vars, holder))
  holder.anim = tl
  if (holder.trigger) triggerEl.set(tl, holder.trigger)
  return guard(tl, Boolean(vars.scrollTrigger))
}

/** Reveal de imagen: clip-path + escala lenta. El peso de lo premium. */
export const revealImage = (wrapper, image, vars = {}) => {
  if (prefersReducedMotion()) {
    gsap.set(wrapper, { clipPath: 'none' })
    return null
  }
  const tl = gsap.timeline(vars)
  tl.fromTo(
    wrapper,
    { clipPath: 'inset(100% 0 0 0)' },
    { clipPath: 'inset(0% 0 0 0)', duration: DUR.slow, ease: EASE.curtain }
  )
  if (image) {
    tl.fromTo(image, { scale: 1.15 }, { scale: 1, duration: DUR.cinematic, ease: EASE.in }, 0)
  }
  return tl
}

/** ScrollTrigger estándar: entra una vez, sin scrub, sin exageraciones */
export const onEnter = (trigger, start = 'top 85%') => ({
  trigger,
  start,
  once: true,
})

/** Contador numérico animado (métricas) */
export const countTo = (node, value, { decimals = 0, suffix = '' } = {}) => {
  const final = value.toFixed(decimals).replace('.', ',') + suffix
  if (prefersReducedMotion()) {
    node.textContent = final
    return null
  }
  const obj = { n: 0 }
  return gsap.to(obj, {
    n: value,
    duration: DUR.cinematic,
    ease: EASE.morph,
    onUpdate: () => {
      node.textContent = obj.n.toFixed(decimals).replace('.', ',') + suffix
    },
    onComplete: () => { node.textContent = final },
  })
}

export { gsap, ScrollTrigger, useGSAP }
