import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

/* ═══════════════════════════════════════════════════════════════
   SISTEMA DE MOVIMIENTO
   Un único vocabulario de easings, duraciones y presets. Los
   componentes no inventan curvas: las consumen desde aquí.
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

/** ¿El usuario ha pedido menos movimiento? */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* Duraciones por defecto de todo el sitio */
gsap.defaults({ ease: EASE.in, duration: DUR.base })

/** Entrada de líneas de texto: y + opacidad con stagger editorial */
export const revealLines = (targets, vars = {}) =>
  gsap.from(targets, {
    y: 60,
    opacity: 0,
    duration: DUR.base,
    ease: EASE.in,
    stagger: STAGGER.text,
    ...vars,
  })

/** Reveal de imagen: clip-path + escala lenta. El peso de lo premium. */
export const revealImage = (wrapper, image, vars = {}) => {
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
export const onEnter = (trigger, start = 'top 80%') => ({
  trigger,
  start,
  once: true,
})

/** Contador numérico animado (métricas) */
export const countTo = (node, value, { decimals = 0, suffix = '' } = {}) => {
  const obj = { n: 0 }
  return gsap.to(obj, {
    n: value,
    duration: DUR.cinematic,
    ease: EASE.morph,
    onUpdate: () => {
      node.textContent = obj.n.toFixed(decimals).replace('.', ',') + suffix
    },
  })
}

export { gsap, ScrollTrigger, useGSAP }
