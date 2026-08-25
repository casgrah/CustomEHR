import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves a project site from /repo-name/, so the build needs to know
// its base path. Vercel, Netlify and `npm run dev` all serve from the root.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
})
