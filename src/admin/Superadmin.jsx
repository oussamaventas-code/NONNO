import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, Check, ChevronDown, CircleAlert, Image as ImageIcon, LockKeyhole,
  LogOut, MapPin, Pizza, Save, Search, ShieldCheck, Sparkles, Upload, Utensils,
} from 'lucide-react'
import { login, getSession, logout, menuAction } from './api'
import { setMenuOverrides, allProducts, CATEGORIES, isHidden } from '../data/menu'
import { PHOTO, img } from '../data/images'
import { ALLERGENS, logoSrc, setSiteContent } from '../data/siteContent'
import { useSiteContent } from '../hooks/useSiteContent'

const NAV = [
  { id: 'imagenes', label: 'Fotos', Icon: ImageIcon },
  { id: 'carta', label: 'Carta', Icon: Utensils },
  { id: 'sedes', label: 'Sedes', Icon: MapPin },
  { id: 'marca', label: 'Marca', Icon: Sparkles },
  { id: 'alergenos', label: 'Alérgenos', Icon: CircleAlert },
  { id: 'privacidad', label: 'Privacidad', Icon: ShieldCheck },
]

const SECTION_IMAGES = [
  { id: PHOTO.venueSangonera, label: 'Fachada de Sangonera', group: 'Portada y sedes' },
  { id: PHOTO.venueSantoAngel, label: 'Fachada de Santo Ángel', group: 'Portada y sedes' },
  { id: PHOTO.ovenFire, label: 'Horno y fuego', group: 'Historia y elaboración' },
  { id: PHOTO.doughBread, label: 'Masa y pan', group: 'Historia y elaboración' },
  { id: PHOTO.basil, label: 'Ingredientes frescos', group: 'Historia y elaboración' },
  { id: PHOTO.flour, label: 'Harina', group: 'Historia y elaboración' },
  { id: PHOTO.slicePull, label: 'Pizza y queso', group: 'Historia y elaboración' },
]

const API_HEADERS = { 'Content-Type': 'application/json' }
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const MAX_SOURCE_IMAGE_BYTES = 25 * 1024 * 1024
const DIRECT_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif'

async function decodeImage(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* intenta el decodificador del navegador */ }
  }
  const objectUrl = URL.createObjectURL(file)
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('Este formato no se puede abrir aquí. Elige una foto JPG o PNG.'))
      image.src = objectUrl
    })
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

async function prepareImage(file) {
  if (file.size > MAX_SOURCE_IMAGE_BYTES) throw new Error('La foto pesa demasiado. Elige una de menos de 25 MB.')
  if (DIRECT_IMAGE_TYPES.has(file.type) && file.size <= MAX_IMAGE_BYTES) return file

  let image
  try { image = await decodeImage(file) } catch (error) {
    throw new Error(error.message || 'No se pudo preparar la foto. Elige una imagen JPG, PNG, WebP o AVIF.')
  }
  try {
    const longest = Math.max(image.width, image.height)
    const scale = Math.min(1, 2000 / longest)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('No se pudo preparar la foto en este dispositivo.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.86, 0.76, 0.66]) {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
      if (blob && blob.size <= MAX_IMAGE_BYTES) return blob
    }
    throw new Error('La foto sigue pesando demasiado. Elige una imagen más pequeña.')
  } finally {
    image.close?.()
  }
}

async function uploadImage(file) {
  const prepared = await prepareImage(file)
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('No hemos podido leer la imagen.'))
    reader.readAsDataURL(prepared)
  })
  const response = await fetch('/api/superadmin', {
    method: 'POST',
    credentials: 'same-origin',
    headers: API_HEADERS,
    body: JSON.stringify({
      action: 'upload',
      mimeType: prepared.type,
      base64: dataUrl.split(',')[1],
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || 'No se pudo subir la imagen.')
  return result.url
}

export default function Superadmin() {
  const [state, setState] = useState('comprobando')
  const [configured, setConfigured] = useState(true)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    getSession()
      .then((session) => {
        setConfigured(session.superadminConfigured)
        setState(session.authenticated ? session.role === 'superadmin' ? 'dentro' : 'denegado' : 'fuera')
      })
      .catch(() => setState('fuera'))
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setSending(true)
    setError('')
    try {
      const session = await login(password)
      setPassword('')
      setState(session.role === 'superadmin' ? 'dentro' : 'denegado')
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  if (state === 'comprobando') {
    return <div className="min-h-screen bg-masa flex items-center justify-center"><p className="mono text-tomate">ABRIENDO NONNO SUPERADMIN…</p></div>
  }

  if (state === 'dentro') {
    return <SuperadminDashboard onSignedOut={() => setState('fuera')} />
  }

  return (
    <main className="min-h-screen bg-masa px-4 py-7 sm:px-6 sm:py-12">
      <div className="mx-auto w-full max-w-md">
        <a href="/" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-wider text-tomate">
          <ArrowLeft className="h-4 w-4" /> Volver a la web
        </a>
        <div className="mt-8 text-center">
          <img src={logoSrc()} alt="La Pizza de Nonno" width="88" height="88" className="mx-auto h-[5.5rem] w-[5.5rem] rounded-full border border-tomate object-cover" />
          <p className="mono mt-4 text-tomate">Solo equipo Nonno</p>
          <h1 className="mt-2 font-display text-4xl font-extrabold text-tomate">Superadmin</h1>
          <p className="mt-2 text-sm text-carbon/65">La carta y la casa, siempre a mano.</p>
        </div>

        <form onSubmit={submit} className="pframe mt-7 bg-crema">
          <div className="pframe-in p-5 sm:p-6">
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full border border-tomate text-tomate">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <label htmlFor="superadmin-password" className="mono mb-2 block text-tomate">Contraseña de dirección</label>
            <input
              id="superadmin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pfield"
              required
            />
            {!configured && <p className="mt-3 rounded-md bg-queso/70 p-3 text-sm text-carbon">Añade SUPERADMIN_PASSWORD en las variables privadas del servidor para activar este acceso.</p>}
            {state === 'denegado' && <p className="mt-3 rounded-md bg-tomate/10 p-3 text-sm font-semibold text-tomate">Esta sesión no tiene permisos de superadmin. Sal de la otra cuenta y entra con la clave de dirección.</p>}
            {error && <p role="alert" className="mt-3 rounded-md bg-tomate/10 p-3 text-sm font-semibold text-tomate">{error}</p>}
            <button type="submit" disabled={sending || !password} className="btn mt-5 w-full bg-tomate text-masa disabled:opacity-50">
              {sending ? 'Comprobando…' : 'Entrar al superadmin'}
            </button>
          </div>
        </form>

        <p className="mono mt-5 text-center normal-case text-carbon/50">Acceso privado · Nonno</p>
      </div>
    </main>
  )
}

function SuperadminDashboard({ onSignedOut }) {
  const liveContent = useSiteContent()
  const [draft, setDraft] = useState(liveContent)
  const [active, setActive] = useState('imagenes')
  const [setupRequired, setSetupRequired] = useState(false)
  const [databaseConfigured, setDatabaseConfigured] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [failure, setFailure] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch('/api/superadmin?admin=1', { credentials: 'same-origin' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'No se pudo abrir la configuración.')
        if (cancelled) return
        setDraft(data.content)
        setSiteContent(data.content)
        setSetupRequired(Boolean(data.setupRequired))
        setDatabaseConfigured(Boolean(data.databaseConfigured))
      } catch (err) {
        if (!cancelled) setFailure(err.message)
      }
    }
    load()
    fetch('/api/menu', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((menu) => { if (menu) setMenuOverrides(menu) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    setDraft((previous) => {
      if (!dirty) return liveContent
      return previous
    })
  }, [liveContent, dirty])

  const updateDraft = (recipe) => {
    setDraft((previous) => {
      const next = typeof recipe === 'function' ? recipe(previous) : recipe
      setDirty(true)
      return next
    })
    setNotice('')
    setFailure('')
  }

  const save = async () => {
    setSaving(true)
    setNotice('')
    setFailure('')
    try {
      const response = await fetch('/api/superadmin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: API_HEADERS,
        body: JSON.stringify({ action: 'save', content: draft }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'No hemos podido guardar.')
      setSiteContent(data.content)
      setDraft(data.content)
      setDirty(false)
      setNotice('Cambios guardados en la web.')
    } catch (err) {
      setFailure(err.message)
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    await logout().catch(() => {})
    onSignedOut()
  }

  return (
    <main className="min-h-screen bg-masa pb-28">
      <header className="border-b border-tomate bg-crema">
        <div className="shell flex min-h-16 items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoSrc()} alt="" width="42" height="42" className="h-10 w-10 rounded-full border border-tomate object-cover" />
            <div className="min-w-0">
              <p className="mono text-tomate">Nonno</p>
              <h1 className="truncate font-display text-xl font-extrabold text-tomate sm:text-2xl">Superadmin</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a href="/" className="hidden min-h-11 items-center gap-2 rounded-md border border-tomate/30 px-3 text-xs font-bold uppercase text-tomate sm:inline-flex">Ver web</a>
            <button onClick={signOut} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-tomate/30 px-3 text-xs font-bold uppercase text-tomate">
              <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <div className="checker" aria-hidden="true" />

      <nav aria-label="Secciones del superadmin" className="sticky top-0 z-40 border-b border-tomate/30 bg-masa/95 backdrop-blur">
        <div className="shell flex gap-2 overflow-x-auto py-3">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              aria-pressed={active === id}
              className={['ptab min-h-11 shrink-0', active === id ? 'is-on' : ''].join(' ')}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </nav>

      <div className="shell pt-6">
        {setupRequired && (
          <div className="mb-5 flex items-start gap-3 rounded-lg border border-horno/70 bg-queso/70 p-4 text-sm leading-relaxed text-carbon">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-horno" />
            <p>
              {databaseConfigured
                ? 'Para guardar los cambios, ejecuta supabase/superadmin.sql en Supabase y supabase/carta.sql para habilitar las fichas editables.'
                : 'El servidor no tiene conexión de base de datos. Añade SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las variables privadas del servidor.'}
            </p>
          </div>
        )}
        {notice && <p role="status" className="mb-4 flex items-center gap-2 rounded-lg border border-albahaca/40 bg-albahaca/10 p-3 text-sm font-semibold text-albahaca"><Check className="h-4 w-4" />{notice}</p>}
        {failure && <p role="alert" className="mb-4 rounded-lg border border-tomate/40 bg-tomate/10 p-3 text-sm font-semibold text-tomate">{failure}</p>}

        {active === 'imagenes' && <ImagesEditor draft={draft} updateDraft={updateDraft} />}
        {active === 'carta' && <MenuEditor allergens={draft.allergens} setNotice={setNotice} setFailure={setFailure} />}
        {active === 'sedes' && <LocationsEditor draft={draft} updateDraft={updateDraft} />}
        {active === 'marca' && <BrandEditor draft={draft} updateDraft={updateDraft} />}
        {active === 'alergenos' && <AllergensEditor draft={draft} updateDraft={updateDraft} />}
        {active === 'privacidad' && <PrivacyEditor draft={draft} updateDraft={updateDraft} />}

        {active !== 'carta' && (
          <div className="fixed inset-x-0 bottom-0 z-50 border-t border-tomate/30 bg-masa/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
              <p className="min-w-0 text-xs text-carbon/65">
                {dirty ? 'Tienes cambios sin guardar.' : 'Los cambios de esta sección se guardan juntos.'}
              </p>
              <button onClick={save} disabled={saving || setupRequired || !dirty} className="btn min-h-11 shrink-0 bg-tomate px-5 text-masa disabled:opacity-45">
                <Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function SectionHeading({ eyebrow, title, text }) {
  return (
    <div className="mb-5">
      <p className="mono text-tomate">{eyebrow}</p>
      <h2 className="mt-1 font-display text-3xl font-extrabold text-tomate sm:text-4xl">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-carbon/65">{text}</p>
    </div>
  )
}

function ImagesEditor({ draft, updateDraft }) {
  const groups = [...new Set(SECTION_IMAGES.map((image) => image.group))]
  return (
    <section>
      <SectionHeading eyebrow="Imágenes del sitio" title="Fotos por apartado" text="Elige una foto desde el móvil. Las imágenes grandes se optimizan automáticamente y puedes previsualizarlas antes de guardar." />
      {groups.map((group) => (
        <div key={group} className="mb-7">
          <h3 className="mono mb-3 text-carbon/55">{group}</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {SECTION_IMAGES.filter((image) => image.group === group).map((image) => (
              <ImageCard
                key={image.id}
                label={image.label}
                src={draft.images?.[image.id] || img(image.id, 500)}
                onUpload={(url) => updateDraft((previous) => ({ ...previous, images: { ...previous.images, [image.id]: url } }))}
                onReset={() => updateDraft((previous) => {
                  const images = { ...previous.images }
                  delete images[image.id]
                  return { ...previous, images }
                })}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="pframe bg-crema">
        <div className="pframe-in flex items-start gap-3 p-4">
          <Pizza className="mt-0.5 h-5 w-5 shrink-0 text-tomate" />
          <p className="text-sm leading-relaxed text-carbon/70">Las fotos de cada plato se cambian en la sección Carta. Estas imágenes sirven para portada, sedes, historia y apartados de elaboración.</p>
        </div>
      </div>
    </section>
  )
}

function ImageCard({ label, src, onUpload, onReset }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const selectFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try { onUpload(await uploadImage(file)) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <article className="pframe bg-crema">
      <div className="pframe-in overflow-hidden">
        <div className="aspect-[16/9] bg-forno/5">
          <img src={src} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="p-3">
          <h3 className="font-sans font-bold text-carbon">{label}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="btn min-h-11 cursor-pointer bg-tomate px-3 text-xs text-masa">
              <Upload className="h-4 w-4" /> {busy ? 'Subiendo…' : 'Cambiar foto'}
              <input type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={selectFile} disabled={busy} />
            </label>
            <button onClick={onReset} className="min-h-11 rounded-md border border-tomate/35 px-3 text-xs font-bold uppercase text-tomate">Foto original</button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-tomate">{error}</p>}
        </div>
      </div>
    </article>
  )
}

function MenuEditor({ allergens, setNotice, setFailure }) {
  const [products, setProducts] = useState(allProducts())
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [busy, setBusy] = useState(false)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    fetch('/api/menu', { credentials: 'same-origin' })
      .then((response) => response.ok ? response.json() : null)
      .then((menu) => {
        if (menu) {
          setMenuOverrides(menu)
          setProducts(allProducts())
          setVersion((value) => value + 1)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setProducts(allProducts())
  }, [version])

  const filtered = useMemo(() => products.filter((product) => product.name.toLowerCase().includes(query.trim().toLowerCase())), [products, query])
  const saveProduct = async (productId, content, price, portionPrices) => {
    setBusy(true)
    setFailure('')
    setNotice('')
    try {
      const result = await menuAction('content', { productId, content, price, portionPrices })
      setMenuOverrides(result)
      setProducts(allProducts())
      setVersion((value) => value + 1)
      setOpenId(null)
      setNotice('Ficha de producto actualizada.')
    } catch (err) {
      setFailure(err.message)
    } finally {
      setBusy(false)
    }
  }
  const toggleVisibility = async (productId, hidden) => {
    setBusy(true)
    setFailure('')
    try {
      const result = await menuAction('hidden', { productId, hidden })
      setMenuOverrides(result)
      setProducts(allProducts())
      setVersion((value) => value + 1)
      setNotice(hidden ? 'Producto oculto de la carta.' : 'Producto visible en la carta.')
    } catch (err) {
      setFailure(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <SectionHeading eyebrow="Menú editable" title="Carta y precios" text="Edita la ficha, la categoría, los ingredientes, los alérgenos confirmados, la foto y el precio. Los cambios se aplican a la carta pública y a los pedidos nuevos." />
      <label className="mb-4 flex min-h-12 items-center gap-3 rounded-lg border border-tomate/35 bg-crema px-4">
        <Search className="h-4 w-4 text-tomate/65" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar plato" className="w-full bg-transparent text-sm outline-none placeholder:text-carbon/40" />
      </label>

      <div className="space-y-3">
        {filtered.map((product) => (
          <ProductEditor
            key={product.id}
            product={product}
            allergens={allergens}
            open={openId === product.id}
            onToggle={() => setOpenId(openId === product.id ? null : product.id)}
            hidden={isHidden(product.id)}
            onToggleHidden={() => toggleVisibility(product.id, !isHidden(product.id))}
            saving={busy}
            onSave={(content, price, portionPrices) => saveProduct(product.id, content, price, portionPrices)}
          />
        ))}
        {!filtered.length && <p className="rounded-lg border border-dashed border-tomate/35 p-5 text-center text-sm text-carbon/60">No hay productos con ese nombre.</p>}
      </div>
    </section>
  )
}

function ProductEditor({ product, allergens, open, onToggle, hidden, onToggleHidden, saving, onSave }) {
  const [form, setForm] = useState(null)
  const [price, setPrice] = useState('')
  const [portions, setPortions] = useState({})

  useEffect(() => {
    if (!open) return
    setForm({
      name: product.name,
      category: product.category,
      description: product.description || '',
      ingredients: (product.ingredients || []).join('\n'),
      image: product.image || null,
      allergens: product.allergens || [],
    })
    setPrice(String(product.price ?? ''))
    setPortions(Object.fromEntries((product.portions || []).map((item) => [item.id, String(item.price)])))
  }, [open, product])

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const selectFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      setForm((current) => ({ ...current, uploading: true }))
      setField('image', await uploadImage(file))
    } catch (error) {
      setForm((current) => ({ ...current, uploadError: error.message, uploading: false }))
      return
    }
    setForm((current) => ({ ...current, uploading: false, uploadError: '' }))
  }

  return (
    <article className="pframe bg-crema">
      <div className="pframe-in">
        <button onClick={onToggle} aria-expanded={open} className="flex min-h-16 w-full items-center gap-3 p-3 text-left">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-tomate/20 bg-masa text-tomate">
            {product.image ? <img src={img(product.image, 120)} alt="" className="h-full w-full rounded-md object-contain" /> : <Pizza className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-sans font-bold text-carbon">{product.name}</span>
            <span className="mono mt-1 block text-carbon/50">{Number(product.price).toFixed(2)} € · {CATEGORIES.find((category) => category.id === product.category)?.label || product.category}</span>
          </span>
          <ChevronDown className={['h-5 w-5 shrink-0 text-tomate transition-transform', open ? 'rotate-180' : ''].join(' ')} />
        </button>
        <div className="px-3 pb-3">
          <button onClick={onToggleHidden} disabled={saving} aria-pressed={hidden} className="min-h-10 rounded-md border border-tomate/30 px-3 text-xs font-bold uppercase text-tomate disabled:opacity-50">
            {hidden ? 'Mostrar en la carta' : 'Ocultar de la carta'}
          </button>
        </div>

        {open && form && (
          <div className="space-y-4 border-t border-tomate/20 p-3 sm:p-4">
            <label className="block">
              <span className="mono mb-1.5 block text-tomate">Nombre del plato</span>
              <input className="pfield" value={form.name} onChange={(event) => setField('name', event.target.value)} maxLength={80} />
            </label>
            <label className="block">
              <span className="mono mb-1.5 block text-tomate">Apartado de la carta</span>
              <select className="pfield" value={form.category} onChange={(event) => setField('category', event.target.value)}>
                {CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mono mb-1.5 block text-tomate">Descripción e ingredientes</span>
              <textarea className="pfield min-h-20" value={form.description} onChange={(event) => setField('description', event.target.value)} maxLength={360} />
            </label>
            <label className="block">
              <span className="mono mb-1.5 block text-tomate">Ingredientes · uno por línea</span>
              <textarea className="pfield min-h-24" value={form.ingredients} onChange={(event) => setField('ingredients', event.target.value)} maxLength={1600} />
            </label>

            {product.portions?.length ? product.portions.map((portion) => (
              <label key={portion.id} className="block">
                <span className="mono mb-1.5 block text-tomate">Precio · {portion.label}</span>
                <input type="number" inputMode="decimal" min="0" max="999.99" step="0.01" className="pfield" value={portions[portion.id] || ''} onChange={(event) => setPortions((current) => ({ ...current, [portion.id]: event.target.value }))} />
              </label>
            )) : (
              <label className="block">
                <span className="mono mb-1.5 block text-tomate">Precio (€)</span>
                <input type="number" inputMode="decimal" min="0" max="999.99" step="0.01" className="pfield" value={price} onChange={(event) => setPrice(event.target.value)} />
              </label>
            )}

            <fieldset>
              <legend className="mono mb-2 text-tomate">Alérgenos confirmados para este producto</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {allergens.map((item) => {
                  const checked = form.allergens.includes(item.id)
                  return (
                    <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-md border border-tomate/20 px-3 text-sm text-carbon">
                      <input type="checkbox" checked={checked} onChange={() => setField('allergens', checked ? form.allergens.filter((id) => id !== item.id) : [...form.allergens, item.id])} />
                      {item.name}
                    </label>
                  )
                })}
              </div>
              <p className="mt-2 text-xs text-carbon/55">Marca solo los que cocina haya confirmado para la receta.</p>
            </fieldset>

            <div>
              <span className="mono mb-2 block text-tomate">Foto del plato</span>
              <div className="mb-3 flex aspect-[16/9] w-full items-center justify-center rounded-md border border-tomate/20 bg-masa">
                {form.image ? <img src={img(form.image, 600)} alt="" className="h-full w-full rounded-md object-contain" /> : <Pizza className="h-8 w-8 text-tomate/60" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="btn min-h-11 cursor-pointer bg-tomate px-3 text-xs text-masa">
                  <Upload className="h-4 w-4" /> {form.uploading ? 'Subiendo…' : 'Elegir foto'}
                  <input type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={selectFile} disabled={form.uploading} />
                </label>
                <button type="button" onClick={() => setField('image', null)} className="min-h-11 rounded-md border border-tomate/35 px-3 text-xs font-bold uppercase text-tomate">Restaurar foto original</button>
              </div>
              {form.uploadError && <p className="mt-2 text-xs font-semibold text-tomate">{form.uploadError}</p>}
            </div>

            <button
              onClick={() => onSave({
                name: form.name,
                category: form.category,
                description: form.description,
                ingredients: form.ingredients.split('\n').map((item) => item.trim()).filter(Boolean),
                image: form.image,
                allergens: form.allergens,
              }, product.portions?.length ? product.price : price, portions)}
              disabled={saving || form.uploading}
              className="btn min-h-12 w-full bg-tomate text-masa disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Guardar ficha y precio
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function LocationsEditor({ draft, updateDraft }) {
  const updateLocation = (id, key, value) => updateDraft((previous) => ({
    ...previous,
    locations: { ...previous.locations, [id]: { ...previous.locations[id], [key]: value } },
  }))
  const locations = [
    { id: 'sangonera', name: 'Sangonera la Verde' },
    { id: 'santo-angel', name: 'Santo Ángel' },
  ]
  return (
    <section>
      <SectionHeading eyebrow="Google Maps y contacto" title="Nuestras sedes" text="Cambia el enlace para abrir el pin correcto, la dirección visible y el punto del local que usa el cálculo de reparto." />
      <div className="space-y-4">
        {locations.map((item) => {
          const value = draft.locations[item.id]
          return (
            <article key={item.id} className="pframe bg-crema">
              <div className="pframe-in space-y-4 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-tomate text-tomate"><MapPin className="h-5 w-5" /></span>
                  <div><p className="mono text-tomate">Sede</p><h3 className="font-display text-xl font-bold text-carbon">{item.name}</h3></div>
                </div>
                <label className="block"><span className="mono mb-1.5 block text-tomate">Dirección</span><input className="pfield" value={value.address} onChange={(event) => updateLocation(item.id, 'address', event.target.value)} maxLength={180} /></label>
                <label className="block"><span className="mono mb-1.5 block text-tomate">Enlace del pin de Google Maps</span><input type="url" inputMode="url" className="pfield" placeholder="https://maps.google.com/…" value={value.mapsUrl} onChange={(event) => updateLocation(item.id, 'mapsUrl', event.target.value)} /></label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block"><span className="mono mb-1.5 block text-tomate">Latitud</span><input type="number" inputMode="decimal" step="any" className="pfield" value={value.lat ?? ''} onChange={(event) => updateLocation(item.id, 'lat', event.target.value)} /></label>
                  <label className="block"><span className="mono mb-1.5 block text-tomate">Longitud</span><input type="number" inputMode="decimal" step="any" className="pfield" value={value.lng ?? ''} onChange={(event) => updateLocation(item.id, 'lng', event.target.value)} /></label>
                </div>
                <label className="block"><span className="mono mb-1.5 block text-tomate">Horario visible</span><input className="pfield" value={value.hours} onChange={(event) => updateLocation(item.id, 'hours', event.target.value)} maxLength={180} /></label>
                {value.mapsUrl && <a href={value.mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 font-bold text-tomate underline underline-offset-4">Abrir y comprobar el pin <MapPin className="h-4 w-4" /></a>}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function BrandEditor({ draft, updateDraft }) {
  const setLogo = (key, value) => updateDraft((previous) => ({ ...previous, logos: { ...previous.logos, [key]: value } }))
  return (
    <section>
      <SectionHeading eyebrow="Logos de Nonno" title="Marca" text="El logo principal aparece en la web, la navegación, los paneles y el ticket digital. El icono se usa en la pestaña y al instalar la web de clientes en iPhone o Android; los iconos internos del panel de cocina y reparto son independientes." />
      <div className="grid gap-4 sm:grid-cols-2">
        <LogoCard label="Logo principal · web y ticket digital" image={draft.logos.main || logoSrc('main')} onUpload={(url) => setLogo('main', url)} onReset={() => setLogo('main', null)} />
        <LogoCard label="Icono · pestaña y app de clientes" image={draft.logos.favicon || logoSrc('favicon')} onUpload={(url) => setLogo('favicon', url)} onReset={() => setLogo('favicon', null)} />
      </div>
    </section>
  )
}

function LogoCard({ label, image, onUpload, onReset }) {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selectFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true); setError('')
    try { onUpload(await uploadImage(file)) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <article className="pframe bg-crema">
      <div className="pframe-in flex h-full flex-col items-center p-5 text-center">
        <div className="flex h-36 w-36 items-center justify-center rounded-full border-2 border-dashed border-tomate/35 bg-masa p-3">
          <img src={image} alt="" className="max-h-full max-w-full object-contain" />
        </div>
        <h3 className="mt-4 font-sans font-bold text-carbon">{label}</h3>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <label className="btn min-h-11 cursor-pointer bg-tomate px-3 text-xs text-masa">
            <Upload className="h-4 w-4" /> {busy ? 'Subiendo…' : 'Cambiar logo'}
              <input type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={selectFile} disabled={busy} />
          </label>
          <button onClick={onReset} className="min-h-11 rounded-md border border-tomate/35 px-3 text-xs font-bold uppercase text-tomate">Restaurar</button>
        </div>
        {error && <p className="mt-2 text-xs font-semibold text-tomate">{error}</p>}
      </div>
    </article>
  )
}

function AllergensEditor({ draft, updateDraft }) {
  const rows = draft.allergens || ALLERGENS
  const setRow = (index, key, value) => updateDraft((previous) => ({
    ...previous,
    allergens: previous.allergens.map((item, i) => i === index ? { ...item, [key]: value } : item),
  }))
  return (
    <section>
      <SectionHeading eyebrow="Información de producto" title="Alérgenos" text="Los ocho grupos que nos has indicado. Aquí se edita la guía general; en Carta se asignan a cada ficha los que cocina confirme." />
      <div className="space-y-3">
        {rows.map((item, index) => (
          <article key={item.id} className="pframe bg-crema">
            <div className="pframe-in space-y-3 p-4">
              <label className="block"><span className="mono mb-1.5 block text-tomate">Alérgeno</span><input className="pfield" value={item.name} onChange={(event) => setRow(index, 'name', event.target.value)} maxLength={80} /></label>
              <label className="block"><span className="mono mb-1.5 block text-tomate">Presencia en el menú</span><input className="pfield" value={item.presence} onChange={(event) => setRow(index, 'presence', event.target.value)} maxLength={100} /></label>
              <label className="block"><span className="mono mb-1.5 block text-tomate">Productos e ingredientes típicos</span><textarea className="pfield min-h-20" value={item.details} onChange={(event) => setRow(index, 'details', event.target.value)} maxLength={360} /></label>
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-carbon/55">La guía general no confirma por sí sola los alérgenos de una receta concreta. Marca la ficha individual solo después de verificarla con cocina.</p>
    </section>
  )
}

function PrivacyEditor({ draft, updateDraft }) {
  const privacy = draft.privacy
  const setField = (key, value) => updateDraft((previous) => ({ ...previous, privacy: { ...previous.privacy, [key]: value } }))
  return (
    <section>
      <SectionHeading eyebrow="Texto público" title="Privacidad y cookies" text="La página pública ya está creada. Completa los datos oficiales, la base del tratamiento, los proveedores y los plazos reales antes de darla por definitiva." />
      <div className="pframe bg-crema">
        <div className="pframe-in space-y-4 p-4 sm:p-5">
          <label className="block"><span className="mono mb-1.5 block text-tomate">Nombre legal del responsable</span><input className="pfield" value={privacy.controllerName} onChange={(event) => setField('controllerName', event.target.value)} maxLength={160} placeholder="Nombre de persona o sociedad" /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">NIF/CIF (opcional)</span><input className="pfield" value={privacy.legalId} onChange={(event) => setField('legalId', event.target.value)} maxLength={40} /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">Dirección de contacto del responsable</span><input className="pfield" value={privacy.address} onChange={(event) => setField('address', event.target.value)} maxLength={180} /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">Correo para privacidad y derechos</span><input type="email" className="pfield" value={privacy.email} onChange={(event) => setField('email', event.target.value)} maxLength={160} placeholder="privacidad@…" /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">Finalidad y base del tratamiento</span><textarea className="pfield min-h-20" value={privacy.legalBasis} onChange={(event) => setField('legalBasis', event.target.value)} maxLength={500} placeholder="Información confirmada por el responsable" /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">Proveedores y destinatarios</span><textarea className="pfield min-h-20" value={privacy.recipients} onChange={(event) => setField('recipients', event.target.value)} maxLength={500} placeholder="Alojamiento, base de datos, mensajería u otros, según corresponda" /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">Plazo de conservación</span><textarea className="pfield min-h-20" value={privacy.retention} onChange={(event) => setField('retention', event.target.value)} maxLength={240} placeholder="Plazos reales para pedidos, facturas y consultas" /></label>
          <label className="block"><span className="mono mb-1.5 block text-tomate">Nota adicional</span><textarea className="pfield min-h-24" value={privacy.extraText} onChange={(event) => setField('extraText', event.target.value)} maxLength={2400} placeholder="Solo información confirmada por el titular" /></label>
          <div className="rounded-md border border-horno/60 bg-queso/50 p-3 text-xs leading-relaxed text-carbon">No se inventan razón social, NIF, proveedores ni plazos. Hasta completar los datos oficiales, la página pública lo indica como pendiente.</div>
        </div>
      </div>
    </section>
  )
}
