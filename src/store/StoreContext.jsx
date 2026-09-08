import {
  createContext, useContext, useReducer, useMemo, useEffect, useRef, useCallback,
} from 'react'
import { SITE } from '../data/site'
import { buildLine, cartSubtotal, cartCount } from '../lib/pricing'
import { getLocation, availableModes } from '../data/locations'

/* ═══════════════════════════════════════════════════════════════
   ESTADO GLOBAL

   Un solo reducer para: sede, carrito, datos del cliente, checkout
   y UI (drawer, modal, toasts). Dos contextos separados —estado y
   acciones— para que los componentes que solo disparan acciones no
   se re-rendericen cuando cambia el carrito.

   Persistencia en localStorage: sede, líneas del carrito y datos
   del cliente. La UI nunca se persiste.
   ═══════════════════════════════════════════════════════════════ */

const EMPTY_CUSTOMER = { name: '', phone: '', address: '', notes: '' }

const initialState = {
  locationId: null,
  lines: [],
  customer: EMPTY_CUSTOMER,
  order: { mode: null, status: 'idle', result: null, errors: {} },
  ui: {
    cartOpen: false,
    productId: null,      // modal de producto
    locationPrompt: false, // "¿desde qué Nonno pedimos?"
    checkoutOpen: false,
    checkoutStep: 1,
    mobileNav: false,
  },
  toasts: [],
}

/* ── Persistencia ──────────────────────────────────────────────── */
const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* modo privado o cuota llena: el pedido sigue funcionando en memoria */
  }
}

function hydrate() {
  if (typeof window === 'undefined') return initialState
  const locationId = read(SITE.storage.location, null)
  const lines = read(SITE.storage.cart, [])
  const customer = read(SITE.storage.customer, EMPTY_CUSTOMER)
  return {
    ...initialState,
    locationId: getLocation(locationId) ? locationId : null,
    lines: Array.isArray(lines) ? lines : [],
    customer: { ...EMPTY_CUSTOMER, ...customer },
  }
}

/* ── Reducer ───────────────────────────────────────────────────── */
function reducer(state, action) {
  switch (action.type) {
    case 'SET_LOCATION': {
      const modes = availableModes(action.id).map((m) => m.id)
      return {
        ...state,
        locationId: action.id,
        /* si el modo elegido no existe en la nueva sede, se limpia */
        order: { ...state.order, mode: modes.includes(state.order.mode) ? state.order.mode : null },
        ui: { ...state.ui, locationPrompt: false },
      }
    }

    case 'ADD_LINE': {
      const line = action.line
      const existing = state.lines.find((l) => l.id === line.id)
      const lines = existing
        ? state.lines.map((l) => (l.id === line.id ? { ...l, qty: l.qty + line.qty } : l))
        : [...state.lines, line]
      return { ...state, lines }
    }

    case 'SET_QTY': {
      const lines = state.lines
        .map((l) => (l.id === action.id ? { ...l, qty: Math.max(0, action.qty) } : l))
        .filter((l) => l.qty > 0)
      return { ...state, lines }
    }

    case 'REMOVE_LINE':
      return { ...state, lines: state.lines.filter((l) => l.id !== action.id) }

    case 'CLEAR_CART':
      return { ...state, lines: [] }

    case 'SET_CUSTOMER':
      return { ...state, customer: { ...state.customer, ...action.patch } }

    case 'SET_MODE':
      return { ...state, order: { ...state.order, mode: action.mode, errors: { ...state.order.errors, mode: null } } }

    case 'SET_ORDER_STATUS':
      return {
        ...state,
        order: {
          ...state.order,
          status: action.status,
          result: action.result ?? state.order.result,
          errors: action.errors ?? {},
        },
      }

    case 'RESET_ORDER':
      return {
        ...state,
        lines: [],
        order: { mode: null, status: 'idle', result: null, errors: {} },
        ui: { ...state.ui, checkoutOpen: false, checkoutStep: 1, cartOpen: false },
      }

    case 'UI':
      return { ...state, ui: { ...state.ui, ...action.patch } }

    case 'TOAST_PUSH':
      return { ...state, toasts: [...state.toasts, action.toast].slice(-3) }

    case 'TOAST_DISMISS':
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) }

    default:
      return state
  }
}

const StateContext = createContext(null)
const ActionsContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, hydrate)
  const toastTimers = useRef(new Map())

  /* Persistencia: solo lo que el usuario espera recuperar */
  useEffect(() => { write(SITE.storage.cart, state.lines) }, [state.lines])
  useEffect(() => { write(SITE.storage.location, state.locationId) }, [state.locationId])
  useEffect(() => { write(SITE.storage.customer, state.customer) }, [state.customer])

  /* Los toasts se limpian solos y sus timers se cancelan al desmontar */
  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      toastTimers.current.delete(id)
    }
    dispatch({ type: 'TOAST_DISMISS', id })
  }, [])

  const pushToast = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    dispatch({ type: 'TOAST_PUSH', toast: { id, ...toast } })
    const timer = setTimeout(() => dismissToast(id), toast.duration || 4200)
    toastTimers.current.set(id, timer)
    return id
  }, [dismissToast])

  useEffect(() => {
    const timers = toastTimers.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  const actions = useMemo(() => {
    const ui = (patch) => dispatch({ type: 'UI', patch })

    return {
      /* Sede */
      setLocation: (id) => dispatch({ type: 'SET_LOCATION', id }),
      openLocationPrompt: () => ui({ locationPrompt: true }),
      closeLocationPrompt: () => ui({ locationPrompt: false }),

      /* Carrito */
      addToCart: (selection) => {
        const line = buildLine(selection)
        if (!line) {
          pushToast({ tone: 'error', title: SITE.messages.error })
          return false
        }
        dispatch({ type: 'ADD_LINE', line })
        pushToast({
          tone: 'success',
          title: SITE.messages.added(line.name),
          image: line.image,
          action: 'VER PEDIDO',
        })
        return true
      },
      setQty: (id, qty) => dispatch({ type: 'SET_QTY', id, qty }),
      increment: (id, current) => dispatch({ type: 'SET_QTY', id, qty: current + 1 }),
      decrement: (id, current) => dispatch({ type: 'SET_QTY', id, qty: current - 1 }),
      removeLine: (id) => dispatch({ type: 'REMOVE_LINE', id }),
      clearCart: () => dispatch({ type: 'CLEAR_CART' }),

      /* Panel del carrito */
      openCart: () => ui({ cartOpen: true, mobileNav: false }),
      closeCart: () => ui({ cartOpen: false }),

      /* Modal de producto */
      openProduct: (productId) => ui({ productId }),
      closeProduct: () => ui({ productId: null }),

      /* Navegación móvil */
      toggleMobileNav: (value) => ui({ mobileNav: value }),

      /* Checkout */
      openCheckout: () => ui({ checkoutOpen: true, cartOpen: false, checkoutStep: 1 }),
      closeCheckout: () => ui({ checkoutOpen: false }),
      setCheckoutStep: (checkoutStep) => ui({ checkoutStep }),
      setMode: (mode) => dispatch({ type: 'SET_MODE', mode }),
      setCustomer: (patch) => dispatch({ type: 'SET_CUSTOMER', patch }),
      setOrderStatus: (status, extra = {}) => dispatch({ type: 'SET_ORDER_STATUS', status, ...extra }),
      resetOrder: () => dispatch({ type: 'RESET_ORDER' }),

      /* Avisos */
      pushToast,
      dismissToast,
    }
  }, [pushToast, dismissToast])

  return (
    <ActionsContext.Provider value={actions}>
      <StateContext.Provider value={state}>{children}</StateContext.Provider>
    </ActionsContext.Provider>
  )
}

/* ── Hooks de consumo ──────────────────────────────────────────── */
export function useStore() {
  const state = useContext(StateContext)
  if (!state) throw new Error('useStore debe usarse dentro de <StoreProvider>')
  return state
}

export function useActions() {
  const actions = useContext(ActionsContext)
  if (!actions) throw new Error('useActions debe usarse dentro de <StoreProvider>')
  return actions
}

/** Carrito ya calculado: líneas, unidades y subtotal */
export function useCart() {
  const { lines } = useStore()
  return useMemo(
    () => ({ lines, count: cartCount(lines), subtotal: cartSubtotal(lines), isEmpty: lines.length === 0 }),
    [lines]
  )
}

/** Sede seleccionada + modos de pedido disponibles en ella */
export function useSelectedLocation() {
  const { locationId } = useStore()
  return useMemo(
    () => ({ locationId, location: getLocation(locationId), modes: availableModes(locationId) }),
    [locationId]
  )
}
