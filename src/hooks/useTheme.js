import { useCallback, useEffect, useState } from 'react'

/* Tema de la web pública: negro (por defecto) o el clásico crema de siempre.
   La clase la pone antes de pintar el script de index.html; aquí solo se
   lee y se cambia. El panel /admin nunca usa el tema negro. */

const KEY = 'nonno.tema'
const CLASE = 'tema-negro'
const COLOR = { negro: '#0C0C0C', clasico: '#E23E57' }

const isDark = () => document.documentElement.classList.contains(CLASE)

export function useTheme() {
  const [dark, setDark] = useState(isDark)

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? COLOR.negro : COLOR.clasico)
  }, [dark])

  const toggle = useCallback(() => {
    const next = !isDark()
    document.documentElement.classList.toggle(CLASE, next)
    try { localStorage.setItem(KEY, next ? 'negro' : 'clasico') } catch { /* sin almacenamiento: vale para esta visita */ }
    setDark(next)
  }, [])

  return { dark, toggle }
}
