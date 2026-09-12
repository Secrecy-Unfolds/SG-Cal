import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1220",
        paper: "#f4f6f9",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
        neutral: {
          ...colors.neutral,
          900: "#0d1b2a",
          950: "#060a12",
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;
