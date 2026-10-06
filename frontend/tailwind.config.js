/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6B46C1',
          light: '#8B6FD4',
          soft: '#F3EEFF',
        },
        secondary: {
          DEFAULT: '#E8577D',
          light: '#F1849C',
          soft: '#FFF0F3',
        },
        rust: {
          DEFAULT: '#C2410C',
          light: '#D85A30',
          soft: '#FAECE7',
        },
        indigo: {
          DEFAULT: '#534AB7',
          light: '#7F77DD',
          soft: '#EEF2FF',
        },
        gold: {
          DEFAULT: '#FFD700',
          soft: '#FFF9E6',
          dark: '#92400E',
        },
        'text-dark': '#1A1A2E',
        'text-main': '#374151',
        'text-muted': '#6B7280',
        'app-border': '#E5E7EB',
        'app-bg': '#F9FAFB',
        'surface': '#FFFFFF',
      },
      fontFamily: {
        heading: ['"DM Sans"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      borderRadius: {
        'card': '20px',
        'pill': '50px',
      },
      boxShadow: {
        'subtle': '0 4px 20px -2px rgba(107, 70, 193, 0.08), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'elevated': '0 12px 32px -4px rgba(107, 70, 193, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.05)',
        'glow': '0 0 25px rgba(107, 70, 193, 0.25)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #6B46C1, #E8577D)',
        'hero-gradient-1': 'linear-gradient(135deg, #FFF4E6, #EEEDFE)',
        'hero-gradient-2': 'linear-gradient(135deg, #EEEDFE, #FAECE7)',
        'card-gradient': 'linear-gradient(180deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.75) 100%)',
      }
    },
  },
  plugins: [],
}
