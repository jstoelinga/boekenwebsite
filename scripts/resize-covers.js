// Verkleint foto's van covers zodat de website snel blijft en de repo klein.
//
// Werkwijze:
//   1. Zet je foto's in de map covers-origineel/ (die staat niet in Git).
//      Naam: <id>-voor of <id>-achter, bijvoorbeeld 9780261102217-voor.jpg
//      (hoofdletters en .jpeg/.png/.webp maken niet uit; het id vind je met: npm run zoek -- titel)
//   2. Draai: npm run covers:verkleinen
//   3. De verkleinde versies (max. 600 px breed, .jpg) staan daarna in public/covers/.
//
// Al verkleinde foto's worden overgeslagen. Opnieuw doen kan met: npm run covers:verkleinen -- --forceer
//
// Let op: iPhone-foto's in HEIC-formaat worden niet ondersteund. Zet de camera op
// "Meest compatibel" (JPEG) of exporteer de foto als JPEG.

import fs from 'node:fs'
import path from 'node:path'
import { PATHS } from './lib/common.js'

const BREEDTE = 600
const KWALITEIT = 82
const TOEGESTANE_EXTENSIES = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff'])
const NAAM_PATROON = /^(\d{13}|gr-\d+)-(voor|achter)$/i
const forceer = process.argv.includes('--forceer')

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Het pakket "sharp" is niet geïnstalleerd. Draai eerst: npm install')
  process.exit(1)
}

if (!fs.existsSync(PATHS.coversOrigineel)) {
  fs.mkdirSync(PATHS.coversOrigineel, { recursive: true })
  console.log('De map covers-origineel/ bestond nog niet en is nu aangemaakt.')
  console.log('Zet je foto\'s daarin (naam: <id>-voor.jpg of <id>-achter.jpg) en draai dit opnieuw.')
  process.exit(0)
}
fs.mkdirSync(PATHS.coversDir, { recursive: true })

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`
let verkleind = 0
let overgeslagen = 0
let mislukt = 0

for (const bestand of fs.readdirSync(PATHS.coversOrigineel).sort()) {
  if (bestand.startsWith('.')) continue
  const bron = path.join(PATHS.coversOrigineel, bestand)
  if (!fs.statSync(bron).isFile()) continue

  const { name, ext } = path.parse(bestand)
  if (!TOEGESTANE_EXTENSIES.has(ext.toLowerCase())) {
    console.log(`✗ ${bestand}: bestandstype ${ext || '(geen)'} wordt niet ondersteund`)
    mislukt++
    continue
  }
  const m = NAAM_PATROON.exec(name)
  if (!m) {
    console.log(`✗ ${bestand}: naam moet <id>-voor of <id>-achter zijn (id = ISBN-13 of gr-nummer)`)
    mislukt++
    continue
  }

  const doel = path.join(PATHS.coversDir, `${m[1].toLowerCase()}-${m[2].toLowerCase()}.jpg`)
  if (!forceer && fs.existsSync(doel) && fs.statSync(doel).mtimeMs >= fs.statSync(bron).mtimeMs) {
    overgeslagen++
    continue
  }

  try {
    await sharp(bron)
      .rotate() // draait de foto goed volgens de camera-instelling (telefoonfoto's)
      .resize({ width: BREEDTE, withoutEnlargement: true })
      .flatten({ background: '#ffffff' }) // transparante PNG's krijgen een witte achtergrond
      .jpeg({ quality: KWALITEIT, mozjpeg: true })
      .toFile(doel)
    console.log(`✓ ${bestand} → ${path.basename(doel)}  (${kb(fs.statSync(bron).size)} → ${kb(fs.statSync(doel).size)})`)
    verkleind++
  } catch (e) {
    console.log(`✗ ${bestand}: ${e.message}`)
    mislukt++
  }
}

console.log(`\nKlaar: ${verkleind} verkleind, ${overgeslagen} overgeslagen (al gedaan), ${mislukt} mislukt.`)
if (verkleind) console.log('Vergeet niet: npm run covers  (of herstart npm run dev) zodat de website de nieuwe covers kent.')
process.exit(mislukt ? 1 : 0)
