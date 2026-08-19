/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F5F1E8',
        ink: '#1C2B2E',
        teal: '#1B4B4F',
        gold: '#B8862E',
        stamp: '#B23A2E',
        card: '#FCFBF6',
        line: '#DCD6C6',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
