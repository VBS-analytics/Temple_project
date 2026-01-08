import type { Config } from 'tailwindcss';

const purpleOrange = {
  50: '#f6f4ff',
  100: '#ede9ff',
  200: '#d9d0ff',
  300: '#bfb0ff',
  400: '#9a86ff',
  500: '#5c41f5',
  600: '#4338ca',
  700: '#312e81',
  800: '#24225e',
  900: '#17153c'
} as const;

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
        },
        orange: purpleOrange
      }
    }
  },
  plugins: [],
} satisfies Config;
