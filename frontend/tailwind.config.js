/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0B132B',
          dark: '#1C2541',
          slate: '#3A506B',
          cyan: '#00B4D8',
          blue: '#0077B6',
          emerald: '#10B981',
          green: '#059669',
          amber: '#F59E0B',
          rose: '#F43F5E',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
