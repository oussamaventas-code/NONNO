import { LOCATIONS, applyLocationOverrides } from './locations.js'
import { setImageOverrides } from './images.js'

export const ALLERGENS = [
  { id: 'gluten', name: 'Gluten', presence: 'Presente en la base', details: 'Masas de pizza tradicionales, focaccias, pan de ajo y rebozados.' },
  { id: 'lacteos', name: 'Lácteos / Lactosa', presence: 'Muy frecuente', details: 'Mozzarella fior di latte, gorgonzola, parmesano/grana padano, queso de cabra y salsas de nata/trufa.' },
  { id: 'soja', name: 'Soja', presence: 'Frecuente / Trazas', details: 'Embutidos procesados, salsas elaboradas y harinas compuestas.' },
  { id: 'frutos-cascara', name: 'Frutos de cáscara', presence: 'Específico / Trazas', details: 'Pesto (nueces/piñones), pistacho picado (en pizzas gourmet como mortadela y pistacho) y postres.' },
  { id: 'huevos', name: 'Huevos', presence: 'Específico', details: 'Postres (tiramisú), masas dulces o pizzas con huevo al horno/salsas emulsionadas.' },
  { id: 'pescado', name: 'Pescado', presence: 'Específico', details: 'Anchoas, atún o salmón en pizzas marineras.' },
  { id: 'sulfitos', name: 'Sulfitos', presence: 'Frecuente', details: 'Conservas vegetales (tomate seco, alcachofas, champiñones en conserva) y embutidos curados.' },
  { id: 'sesamo-apio-mostaza', name: 'Sésamo / Apio / Mostaza', presence: 'Trazas o salsas', details: 'Salsas especiales, marinados de carnes (pollo barbacoa) o panes especiales.' },
]

const defaultLocations = Object.fromEntries(LOCATIONS.map((location) => [
  location.id,
  {
    address: location.address || '',
    mapsUrl: location.mapsUrl || '',
    lat: location.coords?.lat ?? null,
    lng: location.coords?.lng ?? null,
    hours: location.hours || '',
  },
]))

export const DEFAULT_SITE_CONTENT = Object.freeze({
  images: {},
  logos: { main: null, favicon: null },
  locations: defaultLocations,
  allergens: ALLERGENS,
  privacy: {
    controllerName: '',
    legalId: '',
    address: '',
    email: '',
    legalBasis: '',
    recipients: '',
    retention: '',
    extraText: '',
  },
})

const copy = (value) => JSON.parse(JSON.stringify(value))
let current = copy(DEFAULT_SITE_CONTENT)

export function mergeSiteContent(value) {
  return {
    ...copy(DEFAULT_SITE_CONTENT),
    ...(value && typeof value === 'object' ? value : {}),
    images: { ...DEFAULT_SITE_CONTENT.images, ...(value?.images || {}) },
    logos: { ...DEFAULT_SITE_CONTENT.logos, ...(value?.logos || {}) },
    locations: { ...copy(DEFAULT_SITE_CONTENT.locations), ...(value?.locations || {}) },
    allergens: Array.isArray(value?.allergens) ? value.allergens : copy(ALLERGENS),
    privacy: { ...DEFAULT_SITE_CONTENT.privacy, ...(value?.privacy || {}) },
  }
}

export function getSiteContent() {
  return current
}

export function setSiteContent(value) {
  current = mergeSiteContent(value)
  setImageOverrides(current.images)
  applyLocationOverrides(current.locations)

  if (typeof document !== 'undefined') {
    const iconUrl = current.logos.favicon || '/favicon.jpg'
    document.querySelector('link[rel="icon"]')?.setAttribute('href', iconUrl)
    document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', iconUrl)
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('nonno:site-content'))
  return current
}

export const logoSrc = (kind = 'main') =>
  current.logos?.[kind] || (kind === 'favicon' ? '/favicon.jpg' : '/logo-nonno.png')

let loading = null
export async function loadSiteContent({ force = false } = {}) {
  if (loading && !force) return loading
  loading = fetch('/api/superadmin', { credentials: 'same-origin' })
    .then(async (response) => {
      if (!response.ok) return current
      const result = await response.json()
      return setSiteContent(result.content)
    })
    .catch(() => current)
    .finally(() => { loading = null })
  return loading
}
