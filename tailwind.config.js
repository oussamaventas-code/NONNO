/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── NONNO / RETRO ─────────────────────────────────────
        // Los valores viven en src/styles/index.css como canales RGB:
        // el tema se cambia en un solo sitio y admite /opacidad.
        forno: 'rgb(var(--c-forno) / <alpha-value>)',      // Azul noche — historia, footer
        carbon: 'rgb(var(--c-carbon) / <alpha-value>)',    // Tinta      — texto principal
        masa: 'rgb(var(--c-masa) / <alpha-value>)',        // Papel      — lienzo general
        crema: 'rgb(var(--c-crema) / <alpha-value>)',      // Superficie — cards, modales
        panel: 'rgb(var(--c-panel) / <alpha-value>)',      // Panel      — bloques oscuros
        luz: 'rgb(var(--c-luz) / <alpha-value>)',          // Luz        — texto claro
        tomate: 'rgb(var(--c-tomate) / <alpha-value>)',    // Rojo logo  — CTA y acción
        horno: 'rgb(var(--c-horno) / <alpha-value>)',      // Naranja    — hover, highlights
        albahaca: 'rgb(var(--c-albahaca) / <alpha-value>)', // Verde     — estados positivos
        queso: 'rgb(var(--c-queso) / <alpha-value>)',      // Amarillo   — sección de valores
        papel: 'rgb(var(--c-papel) / <alpha-value>)'       // Crema fijo — texto claro sobre color
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      },
      fontSize: {
        // Escala editorial fluida (clamp) para titulares
        'display-sm': ['clamp(2.25rem, 7vw, 3.5rem)', { lineHeight: '0.95', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(2.75rem, 9vw, 5.5rem)', { lineHeight: '0.92', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(3.25rem, 12vw, 8rem)', { lineHeight: '0.88', letterSpacing: '-0.04em' }],
        'display-xl': ['clamp(4rem, 16vw, 12rem)', { lineHeight: '0.84', letterSpacing: '-0.045em' }]
      },
      borderRadius: {
        card: '0.9rem',
        block: '1.25rem',
        hero: '2rem'
      },
      spacing: {
        section: 'clamp(5rem, 12vw, 10rem)'
      },
      transitionTimingFunction: {
        magnetic: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        curtain: 'cubic-bezier(0.76, 0, 0.24, 1)'
      },
      boxShadow: {
        // Sombras duras de cartel retro, nunca difuminadas
        float: '6px 6px 0 0 rgb(29 43 79)',
        island: '4px 4px 0 0 rgb(226 62 87)',
        ember: '6px 6px 0 0 rgb(226 62 87)'
      },
      keyframes: {
        globo: {
          '0%, 100%': { transform: 'rotate(-4deg) scale(1)' },
          '50%': { transform: 'rotate(-1deg) scale(1.05)' }
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(0.82)' }
        },
        emberGlow: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '0.9' }
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' }
        }
      },
      animation: {
        'globo': 'globo 3.2s ease-in-out infinite',
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'ember': 'emberGlow 4s ease-in-out infinite',
        'marquee': 'marquee 40s linear infinite',
        'spin-slow': 'spin 22s linear infinite'
      }
    }
  },
  plugins: []
}
