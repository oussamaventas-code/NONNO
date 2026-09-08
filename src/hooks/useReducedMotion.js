import { useMediaQuery } from './useMediaQuery'

/**
 * Respeta prefers-reduced-motion. Los componentes lo consultan antes
 * de montar parallax, rotaciones continuas o reveals intensos.
 */
export const useReducedMotion = () =>
  useMediaQuery('(prefers-reduced-motion: reduce)')
