import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f4f8ff",
          100: "#e6efff",
          200: "#bed6ff",
          300: "#95bcff",
          400: "#6ca3ff",
          500: "#4289ff",
          600: "#1f6fea",
          700: "#1554b1",
          800: "#0d3a77",
          900: "#051f3d"
        }
      }
    }
  },
  plugins: []
};

export default config;
