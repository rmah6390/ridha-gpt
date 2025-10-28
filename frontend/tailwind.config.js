/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0b0218',
        surface: '#14032c',
        accent: '#7c3aed',
        accentMuted: '#a855f7',
      },
    },
  },
  plugins: [],
};
