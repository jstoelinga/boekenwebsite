import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import boekenApi from './server/vite-plugin.js'

// BELANGRIJK: 'base' moet exact overeenkomen met je GitHub repo-naam,
// anders laadt de site online geen CSS/JS (werkt lokaal wel, live niet).
// Voorbeeld: als je repo heet "mijn-boeken", verander dan '/boekenwebsite/'
// hieronder naar '/mijn-boeken/'.
export default defineConfig({
  // boekenApi: lokale opslag voor "Boek toevoegen", alleen actief bij `npm run dev` (zie server/).
  plugins: [react(), boekenApi()],
  base: '/boekenwebsite/',
})
