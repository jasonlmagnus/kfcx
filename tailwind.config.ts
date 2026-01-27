import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kf: {
          primary: "#667eea",
          secondary: "#764ba2",
          dark: "#1a1a2e",
        },
        nps: {
          promoter: "#22c55e",
          passive: "#eab308",
          detractor: "#ef4444",
        },
      },
      backgroundImage: {
        "kf-gradient": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
