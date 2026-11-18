/**
 * Identidade visual Luxuosa.
 *
 * - `brand`: ameixa profunda (cor primária, herdeira do violeta original, sem gradiente).
 * - `champagne`: acento de marca usado com parcimônia (plano, momentos de marca).
 * - `slate`: neutro quente (pedra). Substitui o slate frio do Tailwind em todo o app,
 *   o que harmoniza também as telas que ainda usam classes utilitárias diretamente.
 * - `violet` / `indigo`: apontam para `brand` para manter consistência em código legado.
 *
 * Os valores vêm de variáveis CSS (styles.css) para permitir ajustes de tema em um só lugar.
 */
const withVar = (name) => `rgb(var(${name}) / <alpha-value>)`;

const scale = (prefix) => ({
  50: withVar(`--${prefix}-50`),
  100: withVar(`--${prefix}-100`),
  200: withVar(`--${prefix}-200`),
  300: withVar(`--${prefix}-300`),
  400: withVar(`--${prefix}-400`),
  500: withVar(`--${prefix}-500`),
  600: withVar(`--${prefix}-600`),
  700: withVar(`--${prefix}-700`),
  800: withVar(`--${prefix}-800`),
  900: withVar(`--${prefix}-900`),
  950: withVar(`--${prefix}-950`)
});

const brand = { ...scale("brand"), DEFAULT: withVar("--brand-700") };
const neutral = scale("neutral");

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["\"Instrument Serif\"", "Georgia", "\"Times New Roman\"", "serif"]
      },
      colors: {
        brand,
        violet: brand,
        indigo: brand,
        purple: brand,
        slate: neutral,
        gray: neutral,
        champagne: scale("champagne"),
        canvas: withVar("--canvas"),
        surface: withVar("--surface"),
        ink: withVar("--ink")
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(28 25 23 / 0.04), 0 0 0 1px rgb(28 25 23 / 0.02)",
        "card-hover": "0 8px 24px -8px rgb(28 25 23 / 0.12), 0 2px 6px -2px rgb(28 25 23 / 0.06)",
        pop: "0 16px 40px -12px rgb(28 25 23 / 0.25), 0 4px 12px -4px rgb(28 25 23 / 0.08)",
        "inner-line": "inset 0 -1px 0 0 rgb(28 25 23 / 0.06)"
      },
      borderRadius: {
        "2xl": "1rem"
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }]
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" }
        }
      },
      animation: {
        shimmer: "shimmer 1.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};
