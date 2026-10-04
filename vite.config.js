import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// BELANGRIJK: 'base' moet exact overeenkomen met je GitHub repo-naam,
// anders laadt de site online geen CSS/JS (werkt lokaal wel, live niet).
// Voorbeeld: als je repo heet "mijn-boeken", verander dan '/boekenwebsite/'
// hieronder naar '/mijn-boeken/'.
export default defineConfig({
  plugins: [react()],
  base: '/boekenwebsite/',
})
