# La Pizza de Nonno

Web de pedidos online para **La Pizza de Nonno**, pizzería artesanal con dos sedes en Murcia (Sangonera la Verde y Santo Ángel). Dirección creativa "NONNO — Artisan Fire": editorial, cinematográfica, cálida.

**Sin pasarela de pago.** El checkout compone y valida el pedido; el pago se resuelve en el local o al recibir el pedido — ver [`src/lib/orderGateway.js`](src/lib/orderGateway.js) para el punto de integración con WhatsApp, una API propia o una plataforma externa.

## Stack

React 19 · Tailwind CSS 3.4 · GSAP 3 + ScrollTrigger · Vite 6 · Lucide React

## Arranque

```bash
npm install
npm run dev
```

## Estructura

Ver [`ARQUITECTURA.md`](ARQUITECTURA.md) para el detalle completo: árbol de componentes, estado global, motor de precios y qué datos son reales frente a datos demo editables (menú, precios, horarios).

Todo el contenido editable (menú, sedes, textos) vive en [`src/data/`](src/data) con comentarios `TODO` señalando qué debe sustituirse por información oficial.
