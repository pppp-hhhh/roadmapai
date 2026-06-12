/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: {
          50:  '#f6f3ec',
          100: '#efeadd',
          200: '#e1d8c2',
          300: '#c8b994',
          400: '#9a8a66',
          500: '#5b4f33',
          600: '#3a311e',
          700: '#26200f',
          800: '#191509',
          900: '#0d0a05',
        },
        seal: {
          50:  '#fdeeea',
          100: '#f9d6cd',
          200: '#f0a897',
          300: '#e07b62',
          400: '#c84a2b',
          500: '#a8351a',
          600: '#7d2611',
          700: '#561808',
        },
        gilt: {
          400: '#c9a96e',
          500: '#a8862f',
          600: '#7c611f',
        },
        night: {
          100: '#151a16',
          200: '#10140f',
          300: '#0a0d0a',
          400: '#0f1411',
          candle: '#e8b56a',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body:    ['Newsreader', 'Georgia', 'serif'],
        mono:    ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'ink-1': '0 1px 0 rgba(38, 32, 15, 0.04), 0 2px 8px rgba(38, 32, 15, 0.06)',
        'ink-2': '0 2px 0 rgba(38, 32, 15, 0.05), 0 12px 28px -8px rgba(38, 32, 15, 0.18)',
        'seal':  '0 0 0 1px rgba(168, 53, 26, 0.4), 0 6px 16px -4px rgba(168, 53, 26, 0.35)',
        'candle':'0 0 0 1px rgba(232, 181, 106, 0.5), 0 0 24px -4px rgba(232, 181, 106, 0.45)',
      },
      letterSpacing: {
        wider2: '0.18em',
      },
      animation: {
        'ink-spread': 'inkSpread 0.9s cubic-bezier(0.16, 1, 0.3, 1) both',
        'stamp':      'stamp 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        'flame':      'flame 2.4s ease-in-out infinite',
      },
      keyframes: {
        inkSpread: {
          '0%':   { opacity: '0', filter: 'blur(6px)', transform: 'translateY(6px)' },
          '100%': { opacity: '1', filter: 'blur(0)', transform: 'translateY(0)' },
        },
        stamp: {
          '0%':   { opacity: '0', transform: 'scale(1.6) rotate(-12deg)' },
          '60%':  { opacity: '1', transform: 'scale(0.92) rotate(2deg)' },
          '100%': { transform: 'scale(1) rotate(-3deg)' },
        },
        flame: {
          '0%,100%': { opacity: '0.85', transform: 'translateY(0) scale(1)' },
          '50%':     { opacity: '1',    transform: 'translateY(-1px) scale(1.04)' },
        },
      },
    },
  },
  plugins: [],
};
