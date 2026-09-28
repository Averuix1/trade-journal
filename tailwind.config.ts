import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#04100d',
          900: '#071915',
          850: '#09201b',
          800: '#0c2620',
          700: '#113129',
          600: '#164034',
          500: '#1d5244',
        },
        line: {
          DEFAULT: '#153a31',
          soft: '#102b25',
          bright: '#1f5c4c',
        },
        mint: {
          100: '#c3ffe6',
          200: '#8bf6cd',
          300: '#4fe8b1',
          400: '#22d39a',
          500: '#12b47f',
          600: '#0c8f65',
        },
        profit: {
          DEFAULT: '#1c7f57',
          soft: '#14603f',
          text: '#7df3bd',
        },
        loss: {
          DEFAULT: '#7a2331',
          soft: '#5d1a25',
          text: '#ff8c96',
        },
        dim: '#6f918a',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
