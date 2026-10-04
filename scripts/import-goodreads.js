// Zet een Goodreads-export (CSV) om naar de twee datasets.
//
// Gebruik:
//   npm run import                                  (leest import/goodreads_library_export.csv)
//   npm run import -- pad/naar/export.csv
//   npm run import -- --zonder-sterren              (Goodreads-sterren niet overnemen)
//   npm run import -- --proef                       (alleen rapport, niets wegschrijven)
//
// Het script VOEGT TOE en overschrijft nooit: boeken die al in gelezen.json staan
// (gematcht op goodreads_id of id) en bestaande beoordelingen blijven precies zoals ze zijn.
// Je kunt het dus veilig opnieuw draaien met een nieuwere export.

import fs from 'node:fs'
import { PATHS, readJson, writeJson, isValidIsbn13, isbn10to13 } from './lib/common.js'

// ---------- Opties ----------
const args = process.argv.slice(2)
const zonderSterren = args.includes('--zonder-sterren')
const proef = args.includes('--proef')
const csvPad = args.find((a) => !a.startsWith('--')) ?? PATHS.importCsv

if (!fs.existsSync(csvPad)) {
  console.error(`Bestand niet gevonden: ${csvPad}`)
  console.error('Zet je Goodreads-export in de map "import/" of geef het pad mee:')
  console.error('  npm run import -- pad/naar/export.csv')
  process.exit(1)
}

// ---------- Kleine CSV-lezer (kan aanhalingstekens en regeleinden binnen velden) ----------
function parseCsv(tekst) {
  const rijen = []
  let rij = []
  let veld = ''
  let tussenQuotes = false
  if (tekst.charCodeAt(0) === 0xfeff) tekst = tekst.slice(1) // BOM weghalen

  for (let i = 0; i < tekst.length; i++) {
    const c = tekst[i]
    if (tussenQuotes) {
      if (c === '"') {
        if (tekst[i + 1] === '"') { veld += '"'; i++ } else tussenQuotes = false
      } else veld += c
    } else if (c === '"') tussenQuotes = true
    else if (c === ',') { rij.push(veld); veld = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && tekst[i + 1] === '\n') i++
      rij.push(veld); rijen.push(rij); rij = []; veld = ''
    } else veld += c
  }
  if (veld !== '' || rij.length) { rij.push(veld); rijen.push(rij) }
  return rijen.filter((r) => !(r.length === 1 && r[0] === ''))
}

const [kopregel, ...datarijen] = parseCsv(fs.readFileSync(csvPad, 'utf8'))
const verwacht = ['Book Id', 'Title', 'Author', 'ISBN', 'ISBN13', 'My Rating', 'Date Read', 'Exclusive Shelf']
const ontbrekend = verwacht.filter((k) => !kopregel.includes(k))
if (ontbrekend.length) {
  console.error(`Dit lijkt geen Goodreads-export: kolommen ontbreken: ${ontbrekend.join(', ')}`)
  process.exit(1)
}
const rijen = datarijen.map((r) => Object.fromEntries(kopregel.map((k, i) => [k, r[i] ?? ''])))

// ---------- Opschonen van velden ----------
// Goodreads schrijft ISBN's als ="9780261102217" (zodat Excel er geen getal van maakt).
const schoonIsbn = (v) => v.replace(/[="\s-]/g, '').toUpperCase()

function schoonDatum(v) {
  const m = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(v.trim())
  if (!m) return null
  const [, j, mnd, d] = m
  const datum = new Date(Date.UTC(+j, +mnd - 1, +d))
  const echt = datum.getUTCFullYear() === +j && datum.getUTCMonth() === +mnd - 1 && datum.getUTCDate() === +d
  return echt ? `${j}-${mnd}-${d}` : null
}

const positiefGetal = (v) => {
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ---------- Bestaande data inlezen ----------
const gelezen = readJson(PATHS.gelezen, [])
const beoordelingen = readJson(PATHS.beoordelingen, [])
const bekendeIds = new Set(gelezen.map((b) => b.id))
const bekendeGoodreadsIds = new Set(gelezen.map((b) => b.goodreads_id).filter(Boolean))
const bekendeBeoordelingen = new Set(beoordelingen.map((b) => b.id))

// ---------- Verwerken ----------
const stats = {
  rijen: rijen.length,
  opRead: 0,
  toRead: 0,
  overig: 0,
  nieuw: 0,
  bestondAl: 0,
  metIsbn13: 0,
  uitIsbn10: 0,
  ongeldigIsbn13: 0,
  metGrId: 0,
  idBotsing: 0,
  zonderDatum: 0,
  nieuweBeoordelingen: 0,
  zonderSterren: 0,
}

for (const rij of rijen) {
  const shelf = rij['Exclusive Shelf']
  if (shelf === 'to-read') { stats.toRead++; continue }
  if (shelf !== 'read') { stats.overig++; continue }
  stats.opRead++

  const goodreadsId = rij['Book Id'].trim()
  if (bekendeGoodreadsIds.has(goodreadsId)) { stats.bestondAl++; continue }

  // Bepaal het ISBN-13: eerst de ISBN13-kolom, anders het ISBN-10 omrekenen.
  const isbn13Kolom = schoonIsbn(rij['ISBN13'])
  const isbn10Kolom = schoonIsbn(rij['ISBN'])
  let isbn = null
  if (isValidIsbn13(isbn13Kolom)) {
    isbn = isbn13Kolom
    stats.metIsbn13++
  } else {
    if (isbn13Kolom) stats.ongeldigIsbn13++
    isbn = isbn10Kolom ? isbn10to13(isbn10Kolom) : null
    if (isbn) stats.uitIsbn10++
  }

  // Het id: ISBN-13, of (zonder bruikbaar ISBN, of bij een botsing) gr-<Goodreads id>.
  let id = isbn ?? `gr-${goodreadsId}`
  if (bekendeIds.has(id)) {
    stats.idBotsing++
    id = `gr-${goodreadsId}`
  }
  if (id.startsWith('gr-')) stats.metGrId++

  const datum = schoonDatum(rij['Date Read'])
  if (!datum) stats.zonderDatum++

  // Alleen velden met een waarde worden opgeslagen (behalve datum_gelezen: null = onbekend).
  const boek = { id }
  if (isbn) boek.isbn = isbn
  boek.goodreads_id = goodreadsId
  boek.titel = rij['Title'].trim()
  boek.auteur = rij['Author'].trim()
  boek.datum_gelezen = datum
  const paginas = positiefGetal(rij['Number of Pages'])
  if (paginas) boek.paginas = paginas
  const jaar = Number.parseInt(rij['Original Publication Year'], 10)
  if (Number.isFinite(jaar)) boek.jaar_origineel = jaar

  gelezen.push(boek)
  bekendeIds.add(id)
  bekendeGoodreadsIds.add(goodreadsId)
  stats.nieuw++

  // Beoordeling: Goodreads-sterren 1-5 (0 betekent "niet beoordeeld").
  const sterren = Math.round(Number(rij['My Rating']))
  if (sterren >= 1 && sterren <= 5) {
    if (!zonderSterren && !bekendeBeoordelingen.has(id)) {
      beoordelingen.push({ id, score: sterren, favoriet: false })
      bekendeBeoordelingen.add(id)
      stats.nieuweBeoordelingen++
    }
  } else stats.zonderSterren++
}

// ---------- Vaste volgorde: laatst gelezen eerst, boeken zonder datum onderaan ----------
gelezen.sort((a, b) => {
  if (a.datum_gelezen !== b.datum_gelezen) {
    if (a.datum_gelezen === null) return 1
    if (b.datum_gelezen === null) return -1
    return a.datum_gelezen < b.datum_gelezen ? 1 : -1
  }
  return a.titel.localeCompare(b.titel, 'nl')
})
const positie = new Map(gelezen.map((b, i) => [b.id, i]))
beoordelingen.sort((a, b) => (positie.get(a.id) ?? 1e9) - (positie.get(b.id) ?? 1e9))

// ---------- Wegschrijven en rapport ----------
if (!proef) {
  writeJson(PATHS.gelezen, gelezen)
  writeJson(PATHS.beoordelingen, beoordelingen)
}

console.log(`Goodreads-export: ${stats.rijen} boeken, waarvan ${stats.opRead} op de shelf "read".`)
console.log(`\ngelezen.json`)
console.log(`  nieuw toegevoegd:         ${stats.nieuw}   (bestond al: ${stats.bestondAl})`)
console.log(`  id = ISBN-13:             ${stats.metIsbn13 + stats.uitIsbn10}   (waarvan omgerekend uit ISBN-10: ${stats.uitIsbn10})`)
console.log(`  id = gr-<Goodreads id>:   ${stats.metGrId}   (geen bruikbaar ISBN)`)
if (stats.ongeldigIsbn13) console.log(`  ongeldig ISBN-13 genegeerd: ${stats.ongeldigIsbn13}`)
if (stats.idBotsing) console.log(`  id-botsingen opgelost:    ${stats.idBotsing}`)
console.log(`  zonder leesdatum:         ${stats.zonderDatum}`)
console.log(`\nbeoordelingen.json`)
if (zonderSterren) console.log(`  sterren overgeslagen (--zonder-sterren)`)
else console.log(`  nieuw toegevoegd:         ${stats.nieuweBeoordelingen}   (zonder sterren op Goodreads: ${stats.zonderSterren})`)
console.log(`\nNiet geïmporteerd: ${stats.toRead} boeken op "to-read"${stats.overig ? `, ${stats.overig} op andere shelves` : ''}.`)
console.log(proef ? '\nProefrun: er is niets weggeschreven.' : `\nGeschreven: ${gelezen.length} boeken, ${beoordelingen.length} beoordelingen.`)
