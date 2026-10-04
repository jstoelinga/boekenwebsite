// Controleert of de data klopt. Draait automatisch vóór `npm run build` (dus ook op GitHub),
// zodat een fout in de JSON de live website nooit kan breken.
//
//   npm run check                      handmatig controleren
//   node scripts/validate-data.js --niet-blokkerend    meldt fouten, maar stopt niet (gebruikt bij `npm run dev`)
//
// ── Het datamodel (dit script is de "wet") ─────────────────────────────────────────────
// gelezen.json  (lijst van objecten)
//   id                 verplicht  ISBN-13 (13 cijfers, geldig controlecijfer) of "gr-<Goodreads Book Id>"
//   titel              verplicht  tekst
//   auteur             verplicht  tekst
//   datum_gelezen      verplicht  "JJJJ-MM-DD" of null (= onbekend)
//   isbn               optioneel  ISBN-13; als id een ISBN is moet het hetzelfde zijn
//   goodreads_id       optioneel  cijfers, als tekst; uniek
//   genre              optioneel  tekst
//   paginas            optioneel  geheel getal > 0
//   jaar_origineel     optioneel  geheel getal
//   cover_url          optioneel  https-link (terugvaloptie als er geen eigen bestand is)
//   beschrijving       optioneel  tekst (origineel)
//   beschrijving_taal  optioneel  taalcode van 2 letters, bijv. "en" of "nl"
//   beschrijving_nl    optioneel  Nederlandse vertaling
//   beschrijving_bron  optioneel  bijv. "openlibrary"
//   goodreads_score    optioneel  getal van 0 tot 5
//
// beoordelingen.json  (lijst van objecten)
//   id         verplicht  moet bestaan in gelezen.json
//   score      verplicht  geheel getal 1 t/m 5
//   favoriet   verplicht  true of false
//   notitie    optioneel  tekst
//
// public/covers/  bestanden heten <id>-voor.jpg of <id>-achter.jpg (kleine letters, .jpg)

import fs from 'node:fs'
import { PATHS, ID_PATTERN, COVER_FILE_PATTERN, readJson, isValidIsbn13 } from './lib/common.js'

const nietBlokkerend = process.argv.includes('--niet-blokkerend')
const fouten = []
const waarschuwingen = []
const fout = (msg) => fouten.push(msg)
const let_op = (msg) => waarschuwingen.push(msg)

const nu = new Date()
const isTekst = (v) => typeof v === 'string' && v.trim() !== ''
const isGeheelGetal = (v) => Number.isInteger(v)

function isEchteDatum(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return false
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]))
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3]
}

function controleerOnbekendeVelden(obj, toegestaan, label) {
  for (const sleutel of Object.keys(obj)) {
    if (!toegestaan.includes(sleutel)) let_op(`${label}: onbekend veld "${sleutel}" (tikfout?)`)
  }
}

// ---------- gelezen.json ----------
const GELEZEN_VELDEN = ['id', 'isbn', 'goodreads_id', 'titel', 'auteur', 'datum_gelezen', 'genre', 'paginas',
  'jaar_origineel', 'cover_url', 'beschrijving', 'beschrijving_taal', 'beschrijving_nl', 'beschrijving_bron', 'goodreads_score']

const gelezen = readJson(PATHS.gelezen, null)
const ids = new Set()
if (!Array.isArray(gelezen)) {
  fout('src/data/gelezen.json ontbreekt of is geen lijst. Draai eerst: npm run import')
} else {
  const goodreadsIds = new Set()
  gelezen.forEach((b, i) => {
    const label = `gelezen.json #${i + 1}${b && b.id ? ` (${b.id})` : ''}`
    if (typeof b !== 'object' || b === null || Array.isArray(b)) return fout(`${label}: is geen object`)

    if (!isTekst(b.id) || !ID_PATTERN.test(b.id)) fout(`${label}: id moet een ISBN-13 of "gr-<nummer>" zijn`)
    else {
      if (/^\d{13}$/.test(b.id) && !isValidIsbn13(b.id)) fout(`${label}: id is geen geldig ISBN-13 (controlecijfer klopt niet)`)
      if (ids.has(b.id)) fout(`${label}: id komt dubbel voor`)
      ids.add(b.id)
    }
    if (!isTekst(b.titel)) fout(`${label}: titel ontbreekt`)
    if (!isTekst(b.auteur)) fout(`${label}: auteur ontbreekt`)

    if (!('datum_gelezen' in b)) fout(`${label}: datum_gelezen ontbreekt (gebruik null als je de datum niet weet)`)
    else if (b.datum_gelezen !== null) {
      if (typeof b.datum_gelezen !== 'string' || !isEchteDatum(b.datum_gelezen)) fout(`${label}: datum_gelezen moet JJJJ-MM-DD zijn (of null)`)
      else if (new Date(b.datum_gelezen) > nu) fout(`${label}: datum_gelezen ligt in de toekomst`)
    }

    if (b.isbn !== undefined) {
      if (!isValidIsbn13(b.isbn)) fout(`${label}: isbn is geen geldig ISBN-13`)
      else if (/^\d{13}$/.test(b.id ?? '') && b.isbn !== b.id) fout(`${label}: isbn en id horen gelijk te zijn`)
    }
    if (b.goodreads_id !== undefined) {
      if (typeof b.goodreads_id !== 'string' || !/^\d+$/.test(b.goodreads_id)) fout(`${label}: goodreads_id moet tekst met alleen cijfers zijn`)
      else if (goodreadsIds.has(b.goodreads_id)) fout(`${label}: goodreads_id komt dubbel voor`)
      goodreadsIds.add(b.goodreads_id)
    }
    if (b.genre !== undefined && !isTekst(b.genre)) fout(`${label}: genre moet tekst zijn`)
    if (b.paginas !== undefined && !(isGeheelGetal(b.paginas) && b.paginas > 0)) fout(`${label}: paginas moet een geheel getal > 0 zijn`)
    if (b.jaar_origineel !== undefined && !(isGeheelGetal(b.jaar_origineel) && b.jaar_origineel <= nu.getFullYear() + 1)) fout(`${label}: jaar_origineel is geen geldig jaar`)
    if (b.cover_url !== undefined && !(typeof b.cover_url === 'string' && b.cover_url.startsWith('https://'))) fout(`${label}: cover_url moet met https:// beginnen`)
    for (const v of ['beschrijving', 'beschrijving_nl', 'beschrijving_bron']) {
      if (b[v] !== undefined && !isTekst(b[v])) fout(`${label}: ${v} moet tekst zijn`)
    }
    if (b.beschrijving_taal !== undefined && !(typeof b.beschrijving_taal === 'string' && /^[a-z]{2}$/.test(b.beschrijving_taal))) fout(`${label}: beschrijving_taal moet een taalcode van 2 kleine letters zijn (bijv. "en")`)
    if (b.goodreads_score !== undefined && !(typeof b.goodreads_score === 'number' && b.goodreads_score >= 0 && b.goodreads_score <= 5)) fout(`${label}: goodreads_score moet een getal van 0 tot 5 zijn`)

    controleerOnbekendeVelden(b, GELEZEN_VELDEN, label)
  })
}

// ---------- beoordelingen.json ----------
const BEOORDELING_VELDEN = ['id', 'score', 'favoriet', 'notitie']
const beoordelingen = readJson(PATHS.beoordelingen, null)
let aantalBeoordelingen = 0
if (!Array.isArray(beoordelingen)) {
  fout('src/data/beoordelingen.json ontbreekt of is geen lijst.')
} else {
  aantalBeoordelingen = beoordelingen.length
  const gezien = new Set()
  beoordelingen.forEach((r, i) => {
    const label = `beoordelingen.json #${i + 1}${r && r.id ? ` (${r.id})` : ''}`
    if (typeof r !== 'object' || r === null || Array.isArray(r)) return fout(`${label}: is geen object`)
    if (!isTekst(r.id)) fout(`${label}: id ontbreekt`)
    else {
      if (gezien.has(r.id)) fout(`${label}: dit boek is dubbel beoordeeld`)
      gezien.add(r.id)
      if (Array.isArray(gelezen) && !ids.has(r.id)) fout(`${label}: dit id bestaat niet in gelezen.json`)
    }
    if (!(isGeheelGetal(r.score) && r.score >= 1 && r.score <= 5)) fout(`${label}: score moet een geheel getal van 1 t/m 5 zijn`)
    if (typeof r.favoriet !== 'boolean') fout(`${label}: favoriet moet true of false zijn`)
    if (r.notitie !== undefined && !isTekst(r.notitie)) fout(`${label}: notitie moet tekst zijn`)
    controleerOnbekendeVelden(r, BEOORDELING_VELDEN, label)
  })
}

// ---------- public/covers ----------
let aantalCovers = 0
if (fs.existsSync(PATHS.coversDir)) {
  for (const naam of fs.readdirSync(PATHS.coversDir).sort()) {
    if (naam.startsWith('.')) continue
    const m = COVER_FILE_PATTERN.exec(naam)
    if (!m) {
      fout(`public/covers/${naam}: ongeldige bestandsnaam. Gebruik <id>-voor.jpg of <id>-achter.jpg, alles in kleine letters (op GitHub Pages telt dat mee).`)
      continue
    }
    aantalCovers++
    if (Array.isArray(gelezen) && !ids.has(m[1])) let_op(`public/covers/${naam}: er is geen boek met id ${m[1]} in gelezen.json`)
    const kb = fs.statSync(`${PATHS.coversDir}/${naam}`).size / 1024
    if (kb > 400) let_op(`public/covers/${naam}: ${Math.round(kb)} KB is groot. Verkleinen kan met: npm run covers:verkleinen`)
  }
}

// ---------- Resultaat ----------
const TOON = 30
function toon(titel, lijst, symbool) {
  if (!lijst.length) return
  console.log(`\n${symbool} ${titel} (${lijst.length})`)
  lijst.slice(0, TOON).forEach((m) => console.log(`  - ${m}`))
  if (lijst.length > TOON) console.log(`  ... en nog ${lijst.length - TOON} meer`)
}
toon('Fouten', fouten, '✗')
toon('Waarschuwingen', waarschuwingen, '!')

const samenvatting = `${Array.isArray(gelezen) ? gelezen.length : 0} boeken, ${aantalBeoordelingen} beoordelingen, ${aantalCovers} covers`
if (fouten.length) {
  console.log(`\n✗ Data bevat fouten (${samenvatting}).`)
  if (nietBlokkerend) console.log('  (Niet blokkerend: de website start toch. `npm run build` stopt hier wel op.)')
  process.exit(nietBlokkerend ? 0 : 1)
}
console.log(`${waarschuwingen.length ? '\n' : ''}✓ Data klopt (${samenvatting}).`)
