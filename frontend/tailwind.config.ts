import type { Config } from 'tailwindcss';

const templeBlue = {
  50: '#E3F2FD',
  100: '#BBDEFB',
  200: '#90CAF9',
  300: '#64B5F6',
  400: '#42A5F5',
  500: '#1E88E5',
  600: '#1976D2',
  700: '#1565C0',
  800: '#0D47A1',
  900: '#082F6A'
} as const;

const templeSaffron = {
  50: '#FFF3E0',
  100: '#FFE0B2',
  200: '#FFCC80',
  300: '#FFB74D',
  400: '#FFA726',
  500: '#F57C00',
  600: '#E65100',
  700: '#BF360C',
  800: '#A84300',
  900: '#7A2F00'
} as const;

const templeTurmeric = {
  50: '#FFFDE7',
  100: '#FFF8E1',
  200: '#FFE082',
  300: '#FFD54F',
  400: '#FBC02D',
  500: '#F5C518',
  600: '#D4A90B',
  700: '#B58F08',
  800: '#8F7106',
  900: '#6A5404'
} as const;

const templeReadable = {
  50: '#FFFFFF',
  100: '#F0F4FF',
  200: '#90CAF9',
  300: '#64B5F6',
  400: '#1565C0',
  500: '#000000',
  600: '#000000',
  700: '#000000',
  800: '#000000',
  900: '#000000'
} as const;

const templeGreen = {
  50: '#E8F5E9',
  100: '#C8E6C9',
  200: '#A5D6A7',
  300: '#81C784',
  400: '#66BB6A',
  500: '#4CAF50',
  600: '#2E7D32',
  700: '#2E7D32',
  800: '#1F5E25',
  900: '#15411A'
} as const;

const templeDanger = {
  50: '#FDECEA',
  100: '#FAD4D0',
  200: '#F5B5AD',
  300: '#EE9184',
  400: '#E36B5A',
  500: '#D64545',
  600: '#C62828',
  700: '#A71D1D',
  800: '#821616',
  900: '#5D1010'
} as const;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: templeReadable,
        gray: templeReadable,
        orange: templeSaffron,
        amber: templeTurmeric,
        blue: templeBlue,
        indigo: templeBlue,
        purple: templeBlue,
        violet: templeBlue,
        green: templeGreen,
        red: templeDanger,
        temple: {
          navTop: '#1565C0',
          navMenu: '#1976D2',
          adminNavTop: '#1565C0',
          adminNavMenu: '#1976D2',
          tab: '#F5C518',
          tabText: '#000000',
          heading: '#000000',
          text: '#000000',
          muted: '#000000',
          border: '#90CAF9',
          pageBg: '#FFFFFF',
          sectionBg: '#F0F4FF',
          cardBg: '#FFFFFF',
          cardTint: '#FFF8E1',
          softBg: '#FFF3E0',
          danger: '#C62828',
          verified: '#1B5E20',
          verifiedBg: '#E8F5E9',
          accessNoBg: '#FFEBEE'
        },
        brand: {
          50: '#FFF3E0',
          100: '#FFE0B2',
          500: '#F57C00',
          600: '#E65100',
          700: '#BF360C'
        }
      }
    }
  },
  plugins: [],
} satisfies Config;
