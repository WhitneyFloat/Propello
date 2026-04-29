import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0D1B2A",
        charcoal: "#1C2B3A",
        teal: "#0D7377",
        "electric-blue": "#14FFEC",
        gold: "#D4A017",
        orange: "#E07B39",
      },
    },
  },
  plugins: [],
};

export default config;
