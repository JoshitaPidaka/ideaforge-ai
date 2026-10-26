/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
      colors: {
        ink: { DEFAULT: "#0F172A", soft: "#334155", mute: "#64748B" },
        brand: { 50: "#EEF2FF", 100: "#E0E7FF", 200: "#C7D2FE", 300: "#A5B4FC", 400: "#818CF8", 500: "#6366F1", 600: "#4F46E5", 700: "#4338CA", 800: "#3730A3", 900: "#1E1B4B" },
        violet: { 500: "#8B5CF6", 600: "#7C3AED" },
        hi: "#E11D48", mid: "#D97706", lo: "#059669", paper: "#0284C7", proj: "#7C3AED",
      },
      boxShadow: { soft: "0 1px 2px rgb(15 23 42 / .04), 0 8px 24px -8px rgb(15 23 42 / .10)", glow: "0 0 0 1px rgb(99 102 241 / .25), 0 12px 40px -12px rgb(99 102 241 / .45)" },
      keyframes: { shimmer: { "100%": { transform: "translateX(100%)" } }, spinSlow: { to: { transform: "rotate(360deg)" } } },
      animation: { shimmer: "shimmer 1.6s infinite", "spin-slow": "spinSlow 6s linear infinite" },
    },
  },
  plugins: [],
};
