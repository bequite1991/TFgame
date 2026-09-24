/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        "bg-deep": "#070B18",
        "bg-panel": "#0D1428",
        primary: "#22E0FF",
        "primary-dim": "#0E7A9C",
        accent: "#FF3D81",
        gold: "#FFC94D",
        violet: "#8B5CF6",
        green: "#3DF08C",
        hp: "#FF5A5A",
        text: "#E8F1FF",
        "text-dim": "#7C8DB0",
        "alien-flesh": "#7A4FD0",
        "alien-glow": "#B8FF3D",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        sans: ["'Noto Sans SC'", "sans-serif"],
      },
      backgroundColor: {
        glass: "rgba(13,20,40,0.72)",
      },
      keyframes: {
        twinkle: {
          "0%, 100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        "pulse-glow": {
          "0%, 100%": {
            boxShadow: "0 0 8px #22E0FF88, 0 0 24px #22E0FF33",
          },
          "50%": {
            boxShadow: "0 0 14px #22E0FFcc, 0 0 42px #22E0FF66",
          },
        },
        "nebula-drift": {
          "0%": { transform: "translate3d(0,0,0) scale(1.1)" },
          "100%": { transform: "translate3d(-3%,-2%,0) scale(1.15)" },
        },
      },
      animation: {
        twinkle: "twinkle 3s ease-in-out infinite",
        "twinkle-slow": "twinkle 4s ease-in-out infinite",
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
        "nebula-drift": "nebula-drift 60s ease-in-out infinite alternate",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
