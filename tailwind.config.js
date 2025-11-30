/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./**/*.{tsx,ts}",
  ],
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#293548',
          850: '#1a2234',
          950: '#0d1117',
        }
      }
    }
  }
}
