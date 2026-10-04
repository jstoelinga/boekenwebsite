/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F6F1E7",
        ink: "#2B2621",
        moss: "#3F5B45",
        gold: "#B8862B",
      },
      fontFamily: {
        serif: ["Lora", "serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
