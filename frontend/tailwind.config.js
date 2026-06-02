/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["\"Plus Jakarta Sans\"", "system-ui", "-apple-system", "Segoe UI", "sans-serif"]
      },
      colors: {
        brand: {
          DEFAULT: "#7c3aed",
          strong: "#1e40af",
          muted: "#ede9fe"
        }
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)",
        "card-hover": "0 10px 25px -5px rgb(15 23 42 / 0.08), 0 4px 10px -6px rgb(15 23 42 / 0.06)"
      },
      borderRadius: {
        "2xl": "1rem"
      }
    }
  },
  plugins: []
};
