import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#4338ca',
          600: '#3730a3',
          700: '#312e81'
        }
      }
    }
  },
  plugins: [],
} satisfies Config;
