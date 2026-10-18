// Hangt de lokale boeken-API (boek-api.js) aan de Vite dev-server, dus aan `npm run dev`.
//
// - apply: 'serve'  -> alleen in de dev-server. Bij `npm run build` (en dus op GitHub Pages) bestaat
//                      deze backend niet. De website merkt dat en toont de knop "Boek toevoegen" dan niet.
// - Geen configurePreviewServer: `npm run preview` toont een eerder gebouwde versie. Daar boeken
//   toevoegen zou misleidend zijn, want die versie ziet nieuwe boeken pas na een nieuwe build.
// - configureServer draait vóór de interne middlewares van Vite (zie de Vite-documentatie), dus de
//   URL bevat hier nog het base-pad (/boekenwebsite/api/...), en alles buiten de API gaat gewoon door.
import { maakBoekApi } from './boek-api.js'

export default function boekenApiPlugin() {
  return {
    name: 'boeken-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(maakBoekApi({ root: server.config.root, basis: server.config.base }))
    },
  }
}
