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
          primary: "#007B5E",
          secondary: "#005A45",
          accent: "#C4A35A",
          dark: "#1F2937",
          light: "#F8FAF9",
        },
        nps: {
          promoter: "#22c55e",
          passive: "#eab308",
          detractor: "#ef4444",
        },
      },
      backgroundImage: {
        "kf-gradient": "linear-gradient(135deg, #007B5E 0%, #005A45 100%)",
      },
      fontFamily: {
        serif: ["Georgia", "serif"],
      },
    },
  },
  plugins: [],
};

export default config;
