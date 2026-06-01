import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          yellow: '#e1b425',
          sky:    '#a8d2eb',
          teal:   '#0ca5aa',
          green:  '#167000',
        },
      },
    },
  },
  plugins: [animate],
};
