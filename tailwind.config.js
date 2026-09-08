/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── NONNO / ARTISAN FIRE ──────────────────────────────
        forno: '#171512',   // Negro Horno   — fondos de alto impacto
        carbon: '#24211E',  // Carbon        — superficies secundarias / texto oscuro
        masa: '#F2EBDD',    // Crema Masa    — fondo general claro
        crema: '#FAF8F2',   // Crema Claro   — cards, modales, superficies
        tomate: '#C8422F',  // Rojo Tomate   — CTA y acción
        horno: '#E76F32',   // Naranja Horno — hover, fuego, highlights
        albahaca: '#465C3A' // Verde Albahaca— ingredientes, estados positivos
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
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
        card: '2rem',
        block: '3rem',
        hero: '4rem'
      },
      spacing: {
        section: 'clamp(5rem, 12vw, 10rem)'
      },
      transitionTimingFunction: {
        magnetic: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        curtain: 'cubic-bezier(0.76, 0, 0.24, 1)'
      },
      boxShadow: {
        float: '0 20px 60px -20px rgba(23, 21, 18, 0.35)',
        island: '0 8px 32px -12px rgba(23, 21, 18, 0.28)',
        ember: '0 0 60px -10px rgba(231, 111, 50, 0.45)'
      },
      keyframes: {
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
        'pulse-dot': 'pulseDot 2s ease-in-out infinite',
        'ember': 'emberGlow 4s ease-in-out infinite',
        'marquee': 'marquee 40s linear infinite'
      }
    }
  },
  plugins: []
}
