/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "rgb(var(--theme-cream) / <alpha-value>)",
        ink: "rgb(var(--theme-ink) / <alpha-value>)",
        moss: "rgb(var(--theme-moss) / <alpha-value>)",
        gold: "rgb(var(--theme-gold) / <alpha-value>)",
        white: "rgb(var(--theme-surface) / <alpha-value>)",
      },
      fontFamily: {
        serif: ["Lora", "serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
