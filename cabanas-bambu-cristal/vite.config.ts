import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base "./" permite publicar em qualquer pasta (GitHub Pages, Netlify, Hostinger...)
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
});
