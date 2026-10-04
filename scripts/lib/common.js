// Gedeelde hulpfuncties voor alle scripts in deze map.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// De projectmap, ongeacht vanuit welke map je het script start.
const scriptsLibDir = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(scriptsLibDir, '..', '..')

export const PATHS = {
  gelezen: path.join(ROOT, 'src/data/gelezen.json'),
  beoordelingen: path.join(ROOT, 'src/data/beoordelingen.json'),
  coversJson: path.join(ROOT, 'src/data/covers.json'), // wordt gegenereerd
  coversDir: path.join(ROOT, 'public/covers'),
  coversOrigineel: path.join(ROOT, 'covers-origineel'), // grote foto's, niet in Git
  importCsv: path.join(ROOT, 'import/goodreads_library_export.csv'),
}

// Een id is een ISBN-13 (13 cijfers) of "gr-" + het Goodreads Book Id.
export const ID_PATTERN = /^(\d{13}|gr-\d+)$/

// Toegestane bestandsnamen in public/covers/, bijvoorbeeld 9780261102217-voor.jpg
export const COVER_FILE_PATTERN = /^(\d{13}|gr-\d+)-(voor|achter)\.jpg$/

export function readJson(file, fallback) {
  if (!fs.existsSync(file)) return fallback
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n')
}

// ---------- ISBN ----------

// Controlecijfer van een ISBN-13 klopt? (ook een tikfout in één cijfer valt hier op)
export function isValidIsbn13(s) {
  if (typeof s !== 'string' || !/^\d{13}$/.test(s)) return false
  let som = 0
  for (let i = 0; i < 13; i++) som += Number(s[i]) * (i % 2 === 0 ? 1 : 3)
  return som % 10 === 0
}

// Zet een geldig ISBN-10 om naar ISBN-13. Geeft null als het ISBN-10 ongeldig is.
export function isbn10to13(isbn10) {
  if (typeof isbn10 !== 'string' || !/^\d{9}[\dX]$/.test(isbn10)) return null
  let som10 = 0
  for (let i = 0; i < 10; i++) {
    const waarde = isbn10[i] === 'X' ? 10 : Number(isbn10[i])
    som10 += (10 - i) * waarde
  }
  if (som10 % 11 !== 0) return null

  const kern = '978' + isbn10.slice(0, 9)
  let som13 = 0
  for (let i = 0; i < 12; i++) som13 += Number(kern[i]) * (i % 2 === 0 ? 1 : 3)
  return kern + String((10 - (som13 % 10)) % 10)
}
