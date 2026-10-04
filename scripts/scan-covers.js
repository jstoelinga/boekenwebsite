// Kijkt welke coverbestanden in public/covers/ staan en schrijft src/data/covers.json:
//   { "9780261102217": { "voor": true, "achter": true }, ... }
// De website gebruikt dat bestand om te weten voor welke boeken je een eigen cover hebt
// (de browser kan zelf niet "kijken" of een bestand bestaat zonder een 404-fout).
//
// Draait automatisch bij `npm run dev` en `npm run build`. Handmatig: npm run covers
// Tijdens `npm run dev` ververst de website vanzelf zodra dit bestand verandert.

import fs from 'node:fs'
import { PATHS, COVER_FILE_PATTERN, writeJson } from './lib/common.js'

const covers = {}
let aantalBestanden = 0

if (fs.existsSync(PATHS.coversDir)) {
  for (const naam of fs.readdirSync(PATHS.coversDir).sort()) {
    const m = COVER_FILE_PATTERN.exec(naam)
    if (!m) continue // ongeldige namen meldt validate-data.js
    const [, id, kant] = m
    covers[id] = { ...covers[id], [kant]: true }
    aantalBestanden++
  }
}

writeJson(PATHS.coversJson, covers)
console.log(`Covers: ${aantalBestanden} bestanden voor ${Object.keys(covers).length} boeken.`)
