/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        dark: {
          bg: "#0B0F19",       // Deep dark slate-navy
          card: "#161B26",     // Slate card color
          border: "#242D3D",   // Soft border
          hover: "#2B374A",    // Soft hover highlight
          accent: "#3B82F6",   // Indigo blue
          success: "#10B981",  // Emerald green
          danger: "#EF4444",   // Red warning
          neutral: "#9CA3AF"   // Gray secondary text
        }
      }
    },
  },
  plugins: [],
}
