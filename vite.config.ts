import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base: './' keeps asset paths relative so the build works on any static host
// (GitHub Pages, Netlify, a shared-hosting folder) without extra config.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
