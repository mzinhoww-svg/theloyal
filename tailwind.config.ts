import type { Config } from "tailwindcss";

// Tokens: DESIGN.md secao Cores. Fonte unica de verdade; nunca hardcodar hex nos componentes.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: { DEFAULT: "#FAF7F0", dark: "#F1ECE1" },
        surface: "#FFFFFF",
        line: "#E5E0D5",
        gray: { 700: "#3D3A34", 500: "#555555", 400: "#8A8578" },
        green: { 100: "#D9F4E9", 500: "#00C48C", 600: "#00A878", 700: "#007A57" },
        blue: { 100: "#E4EAFF", 600: "#315CFF", 700: "#2547CC" },
        yellow: { 100: "#FCF0CE", 500: "#F2C94C" },
        red: { 100: "#F9E2E2", 600: "#D64545", 700: "#B53A3A" },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "Consolas", "monospace"],
      },
      maxWidth: { content: "720px", page: "1200px" },
      borderRadius: { DEFAULT: "8px", sm: "6px", lg: "12px" },
      boxShadow: {
        sm: "0 1px 3px rgba(17,17,17,0.08)",
        focus: "0 0 0 3px rgba(49,92,255,0.35)",
      },
      transitionTimingFunction: { standard: "cubic-bezier(0.2,0,0,1)" },
    },
  },
  plugins: [],
};
export default config;
