# LA PIZZA DE NONNO — Arquitectura

**Dirección creativa:** NONNO — ARTISAN FIRE
**Stack:** React 19.2 · Tailwind 3.4.17 · GSAP 3.15 + ScrollTrigger · Lucide React · Vite 6

---

## 1. Árbol del proyecto

```
NONNO/
├─ index.html                  SEO, Open Graph, Google Fonts, preconnect
├─ tailwind.config.js          tokens: color, tipografía, radios, easings, keyframes
├─ vite.config.js
├─ ARQUITECTURA.md             este documento
└─ src/
   ├─ main.jsx                 monta <StoreProvider><App/>            [FASE 2]
   ├─ App.jsx                  shell: orden de secciones + capas globales  [FASE 2]
   ├─ styles/
   │  └─ index.css             base, .btn magnético, .ticket, .grain, reduced-motion
   ├─ data/                    ← TODO EL CONTENIDO EDITABLE VIVE AQUÍ
   │  ├─ site.js               marca, SEO, moneda, adaptador de pedidos, mensajes UI
   │  ├─ images.js             40 URLs reales verificadas + helper srcSet
   │  ├─ locations.js          sedes (dato real vs. dato pendiente)
   │  ├─ menu.js               categorías, tamaños, extras y 24 productos demo
   │  ├─ content.js            copy de hero, métricas, proceso, editorial, micro-UIs
   │  └─ faq.js                6 preguntas con respuestas neutrales
   ├─ lib/
   │  ├─ format.js             moneda es-ES, decimales, reloj, referencia de pedido
   │  ├─ pricing.js            motor de precios: base + extras × cantidad
   │  ├─ orderGateway.js       ⚡ PUNTO DE INTEGRACIÓN DEL BACKEND
   │  └─ motion.js             easings, duraciones, splitWords, reveals, countTo
   ├─ hooks/
   │  ├─ useMediaQuery.js      + useIsDesktop / useIsMobile
   │  ├─ useReducedMotion.js
   │  ├─ useLockBodyScroll.js
   │  ├─ useFocusTrap.js       foco atrapado + Escape + retorno de foco
   │  └─ useScrolled.js        IntersectionObserver (sin listeners de scroll)
   ├─ store/
   │  └─ StoreContext.jsx      reducer único + persistencia + hooks de consumo
   └─ components/              [FASE 2] — ver mapa en §4
```

---

## 2. Estado global

Un reducer, dos contextos (estado / acciones) para no re-renderizar de más.

```js
{
  locationId: 'sangonera' | 'santo-angel' | null,
  lines: [{ id, productId, name, image, sizeId, sizeLabel,
            extraIds, extraLabels, note, qty, unitPrice }],
  customer: { name, phone, address, notes },
  order: { mode: 'pickup'|'delivery'|null, status, result, errors },
  ui: { cartOpen, productId, locationPrompt, checkoutOpen, checkoutStep, mobileNav },
  toasts: [{ id, tone, title, image, action }]
}
```

**Persistido en localStorage:** `lines`, `locationId`, `customer`.
**Nunca persistido:** `ui`, `toasts`, `order.status`.

**Hooks de consumo**
| Hook | Devuelve |
|---|---|
| `useStore()` | estado completo |
| `useActions()` | acciones estables (no provocan re-render) |
| `useCart()` | `{ lines, count, subtotal, isEmpty }` |
| `useSelectedLocation()` | `{ locationId, location, modes }` |

**Regla de negocio:** los modos de pedido salen de la sede (`availableModes`). Si se cambia de sede y el modo elegido no existe allí, se limpia solo. Nunca se asume que ambas sedes ofrecen lo mismo.

---

## 3. Datos: qué es real y qué es demo

| Dato | Estado |
|---|---|
| Nombres de las dos sedes | **Proporcionado** |
| Valoración 4,9 · 179 reseñas (Sangonera) | **Proporcionado** |
| Valoración 5,0 · 33 reseñas (Santo Ángel) | **Proporcionado** |
| Servicios: llevar + entrega (Sangonera) | **Proporcionado** |
| Dirección, teléfono, horarios, enlace de pedido | `null` → **la UI oculta el campo** |
| Carta, precios, tamaños, extras | **DEMO EDITABLE** marcado con `TODO` |
| Fotografía | Unsplash verificada → sustituir por foto propia |

Ningún dato inventado se presenta como oficial. Las respuestas de FAQ son neutrales a propósito.

---

## 4. Mapa de componentes (FASE 2)

Orden exacto de la experiencia. Cada componente es funcional: no hay cascarones.

| # | Componente | Función | Movimiento |
|---|---|---|---|
| — | `Grain` | capa global de ruido SVG (feTurbulence, 0.05, sin eventos) | estática |
| 01 | `Navbar` | isla flotante; transparente → crema al hacer scroll; contador de carrito | `useScrolled` + GSAP |
| 01b | `MobileNav` | panel fullscreen con cortina `clip-path` | GSAP timeline |
| 02 | `Hero` | 100dvh, titular en 3 líneas, ficha "estado del horno", badges | reveal líneas + escala 1.1→1 |
| 03 | `LocationSelector` | dos tarjetas grandes; fija `selectedLocation`; estado SEDE SELECCIONADA | ScrollTrigger cards |
| 04 | `Metrics` | 4 métricas sobre negro horno | `countTo` con ScrollTrigger |
| 05 | `Menu` | tabs sticky + grid editorial alternada (`tall`/`circle`/`wide`) | stagger 0.15 |
| 05b | `ProductCard` | 3 variantes de layout, botón + circular | hover: imagen 1.05 |
| 06 | `FeaturedProduct` | Nonno Speciale a pantalla casi completa, rotación de 1° | rotación muy lenta |
| 07 | `Experience` | tres pilares: masa, horno, ingredientes | reveal de imagen `clip-path` |
| 08 | `KitchenFeed` | "EL HORNO NO PARA": tickets cada 2,5 s, máximo 3 | `setInterval` con cleanup |
| 09 | `KitchenDashboard` | KPIs de marca etiquetados VISUAL EXPERIENCE | `stroke-dashoffset` |
| 10 | `BeforeAfter` | divisor arrastrable antes/después | pointer events + GSAP |
| 11 | `Process` | timeline 01→02→03, horizontal en desktop | SVG `stroke-dasharray` |
| 12 | `Editorial` | "NO HACEMOS PIZZA RÁPIDA" palabra a palabra | `splitWords` propio |
| 13 | `Faq` | acordeón, icono + → × | altura + rotación |
| 14 | `FinalCta` | bloque rojo tomate a toda pantalla | reveal |
| 15 | `Footer` | 4 columnas, `rounded-t-[4rem]`, estado del sistema | punto verde pulsante |
| G1 | `CartDrawer` | lateral en desktop / bottom sheet en móvil | siempre montado |
| G2 | `ProductModal` | tamaño, extras, cantidad, nota; precio en vivo | bottom sheet en móvil |
| G3 | `LocationPrompt` | "¿DESDE QUÉ NONNO PEDIMOS?" — nunca un `alert` | modal premium |
| G4 | `Checkout` | 4 pasos: sede → modo → datos → resumen | panel |
| G5 | `StickyOrderBar` | barra inferior móvil / botón flotante desktop | aparece con carrito |
| G6 | `Toasts` | tickets de cocina "🍕 Margherita añadida · VER PEDIDO" | slide-up |

---

## 5. Sistema de movimiento

Todo pasa por `src/lib/motion.js`. Ningún componente inventa curvas.

- **Entradas:** `power3.out` · **Morphs:** `power2.inOut` · **Cortinas:** `expo.inOut`
- **Stagger:** texto `0.08`, cards `0.15`
- **Reveal de imagen:** `clip-path: inset(100% 0 0 0)` → `inset(0)` + escala `1.15 → 1`
- **Texto por palabras:** `splitWords()` propio, sin plugins de pago
- **Ciclo de vida:** todo dentro de `gsap.context()` en `useEffect` con `return () => ctx.revert()`
- **ScrollTrigger:** solo en métricas, timeline, cards, editorial y reveals. El resto es estático a propósito: el contraste es lo que da valor al movimiento.
- **`prefers-reduced-motion`:** apagado real en CSS y comprobado en JS antes de montar parallax o rotaciones continuas.

---

## 6. Flujo de pedido

```
Elegir pizza → ProductModal (tamaño + extras + cantidad + nota)
     └─ ¿hay sede? ── no ──> LocationPrompt ──> vuelve al modal
     └─ sí ──> addToCart() ──> Toast + contador navbar + sticky bar
CartDrawer ──> CONTINUAR CON EL PEDIDO
Checkout  01 SEDE → 02 RECOGER/ENTREGA → 03 DATOS → 04 RESUMEN
     └─ submitOrder() ──> src/lib/orderGateway.js
```

### Punto de integración

`submitOrder()` valida, normaliza y enruta según `SITE.ordering.adapter`:

| adapter | comportamiento |
|---|---|
| `none` *(actual)* | devuelve el pedido compuesto: **"Pedido listo para enviar"** |
| `whatsapp` | `wa.me` con el pedido formateado (requiere teléfono en `locations.js`) |
| `api` | `POST` a `SITE.ordering.apiEndpoint` |
| `external` | redirige al `orderUrl` de la sede (pideme.net u otra) |

El contrato (`buildOrderPayload`) ya incluye referencia, sede, modo, cliente, líneas, unidades y total. Conectar el backend es cambiar una cadena y rellenar un campo.

---

## 7. Responsive y accesibilidad

- **Mobile-first.** Objetivos táctiles ≥ 48 px (`.btn` fija `min-height: 48px`).
- Móvil: hero 100dvh, tabs con scroll horizontal, 1 columna, modal y carrito como bottom sheet, sticky order bar con `env(safe-area-inset-bottom)`.
- Tablet: 2 columnas. Desktop: layouts editoriales con aire.
- Botones reales (`<button>`), `aria-label` en iconos, foco visible, `useFocusTrap` en modales, `alt` descriptivo en todas las imágenes.
- Imágenes `loading="lazy"` salvo el hero (`fetchpriority="high"`).

---

## 8. Fases

1. ✅ **Estructura** — configuración, tokens, datos, motor de precios, estado, hooks, gateway.
2. ⏭ **Experiencia funcional** — shell, menú, modal, carrito, sedes, checkout.
3. ⏭ **Sistema visual** — layouts editoriales, tratamiento de imagen, detalles de marca.
4. ⏭ **GSAP** — reveals, timeline, métricas, editorial, micro-UIs.
5. ⏭ **Revisión** — responsive, accesibilidad, rendimiento, limpieza de animaciones.
