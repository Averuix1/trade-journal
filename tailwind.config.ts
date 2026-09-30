import type { Config } from 'tailwindcss';

/** Colours resolve through the CSS variables in src/app/globals.css. */
const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: channel('ink-950'),
          900: channel('ink-900'),
          850: channel('ink-850'),
          800: channel('ink-800'),
          700: channel('ink-700'),
          600: channel('ink-600'),
          500: channel('ink-500'),
        },
        line: {
          DEFAULT: channel('line'),
          soft: channel('line-soft'),
          bright: channel('line-bright'),
        },
        mint: {
          100: channel('mint-100'),
          200: channel('mint-200'),
          300: channel('mint-300'),
          400: channel('mint-400'),
          500: channel('mint-500'),
          600: channel('mint-600'),
        },
        profit: {
          DEFAULT: channel('profit'),
          soft: channel('profit-soft'),
          text: channel('profit-text'),
        },
        loss: {
          DEFAULT: channel('loss'),
          soft: channel('loss-soft'),
          text: channel('loss-text'),
        },
        warn: {
          DEFAULT: channel('warn'),
          soft: channel('warn-soft'),
          line: channel('warn-line'),
        },
        fg: {
          DEFAULT: channel('fg'),
          strong: channel('fg-strong'),
        },
        dim: channel('dim'),
        'on-accent': channel('on-accent'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
