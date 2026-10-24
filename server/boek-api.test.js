// Kleine lokale "backend" waarmee de website een gelezen boek kan toevoegen aan je JSON-bestanden.
//
// Waarom dit bestaat: een React/Vite-pagina in de browser kan zelf geen bestanden op je schijf
// wijzigen. Dit stukje Node-code draait in de dev-server (zie vite-plugin.js) en doet het schrijfwerk.
//
// Wat er per nieuw boek gebeurt:
//   src/data/gelezen.json        + 1 regel (id, isbn, goodreads_id, titel, auteur, datum_gelezen)
//   src/data/beoordelingen.json  + 1 regel, ALLEEN als je een beoordeling (1-5) opgeeft (score, favoriet, notitie)
//   public/covers/<id>-voor.jpg  alleen als je een cover uploadt (verkleind naar 600 px breed)
//   src/data/covers.json         bijgewerkt (gegenereerd bestand, zelfde formaat als scripts/scan-covers.js)
//
// Veiligheid voor je bestaande gegevens:
//   - Bestaande boeken en beoordelingen worden nooit gewijzigd: er komt alleen een regel bij.
//   - Een bestaand coverbestand wordt nooit overschreven (aanmaken met flag "wx" + vooraf controleren).
//   - JSON wordt atomair weggeschreven (tijdelijk bestand + hernoemen), dus nooit half geschreven.
//   - Gaat er halverwege iets mis, dan worden alle bestanden teruggezet zoals ze waren.
//   - Is gelezen.json niet te lezen als JSON, dan wordt er NIETS geschreven (anders zou een kapot
//     bestand vervangen worden door een bestand met één boek).
//   - Alles wat hier wordt weggeschreven moet door scripts/validate-data.js komen; de regels zijn gelijk.
//   - Alleen bereikbaar via localhost, alleen application/json, en niet vanaf andere websites (Origin-controle).
//   
import fs from 'node:fs'
import path from 'node:path'
import { COVER_FILE_PATTERN, isValidIsbn13, isbn10to13 } from '../scripts/lib/common.js'

// De validator eist een auteur; blijft dat veld leeg, dan bewaren we deze tekst.
export const ONBEKENDE_AUTEUR = 'Onbekende auteur'

const MAX_BODY_BYTES = 25 * 1024 * 1024
const MAX_COVER_BYTES = 20 * 1024 * 1024
const COVER_BREEDTE = 600 // zelfde als scripts/resize-covers.js
const COVER_KWALITEIT = 82 // zelfde als scripts/resize-covers.js
const TOEGESTANE_FORMATEN = new Set(['jpeg', 'png', 'webp', 'gif', 'tiff', 'avif'])
const MAX_LENGTE = { titel: 300, auteur: 200, notitie: 5000 }

class ApiFout extends Error {
  constructor(status, melding, extra = {}) {
    super(melding)
    this.status = status
    this.extra = extra
  }
}

// ---------- Bestanden ----------

function padenVoor(root) {
  return {
    gelezen: path.join(root, 'src/data/gelezen.json'),
    beoordelingen: path.join(root, 'src/data/beoordelingen.json'),
    coversJson: path.join(root, 'src/data/covers.json'),
    coversDir: path.join(root, 'public/covers'),
  }
}

export function schrijfTekstAtomisch(bestand, tekst) {
  const tijdelijk = `${bestand}.${process.pid}.tmp`
  try {
    fs.writeFileSync(tijdelijk, tekst)
    fs.renameSync(tijdelijk, bestand)
  } catch (e) {
    fs.rmSync(tijdelijk, { force: true })
    throw e
  }
}

// Zelfde opmaak als scripts/lib/common.js (writeJson), zodat bestaande regels er identiek uitblijven zien.
export function schrijfJsonAtomisch(bestand, data) {
  schrijfTekstAtomisch(bestand, JSON.stringify(data, null, 2) + '\n')
}

function leesLijst(bestand, naam, { magOntbreken = false } = {}) {
  if (!fs.existsSync(bestand)) {
    if (magOntbreken) return { tekst: '[]\n', lijst: [] }
    throw new ApiFout(500, `${naam} ontbreekt. Er is niets opgeslagen.`)
  }
  const tekst = fs.readFileSync(bestand, 'utf8')
  let lijst
  try {
    lijst = JSON.parse(tekst)
  } catch {
    throw new ApiFout(500, `${naam} is geen geldige JSON. Er is niets opgeslagen; herstel dat bestand eerst (bijvoorbeeld met git).`)
  }
  if (!Array.isArray(lijst)) throw new ApiFout(500, `${naam} heeft een onverwacht formaat. Er is niets opgeslagen.`)
  return { tekst, lijst }
}

// Zelfde resultaat als scripts/scan-covers.js: { "<id>": { "voor": true, "achter": true } }
function scanCovers(paden) {
  const covers = {}
  if (fs.existsSync(paden.coversDir)) {
    for (const naam of fs.readdirSync(paden.coversDir).sort()) {
      const m = COVER_FILE_PATTERN.exec(naam)
      if (!m) continue
      covers[m[1]] = { ...covers[m[1]], [m[2]]: true }
    }
  }
  return covers
}

// ---------- Invoer controleren ----------

function eenregelig(waarde, veld, label, max) {
  if (waarde == null) return ''
  if (typeof waarde !== 'string') throw new ApiFout(400, `${label} moet tekst zijn.`, { veld })
  const schoon = waarde.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim()
  if (schoon.length > max) throw new ApiFout(400, `${label} is te lang (maximaal ${max} tekens).`, { veld })
  return schoon
}

function meerregelig(waarde, veld, label, max) {
  if (waarde == null) return ''
  if (typeof waarde !== 'string') throw new ApiFout(400, `${label} moet tekst zijn.`, { veld })
  const schoon = waarde.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim()
  if (schoon.length > max) throw new ApiFout(400, `${label} is te lang (maximaal ${max} tekens).`, { veld })
  return schoon
}

// Geeft een ISBN-13 terug (ISBN-10 wordt omgerekend, net als bij de Goodreads-import) of null.
function normaliseerIsbn(waarde) {
  if (waarde == null) return null
  if (typeof waarde !== 'string') throw new ApiFout(400, 'ISBN moet tekst zijn.', { veld: 'isbn' })
  const schoon = waarde.replace(/^\s*ISBN(-1[03])?\s*:?\s*/i, '').replace(/[\s-]/g, '').toUpperCase()
  if (!schoon) return null
  if (/^\d{13}$/.test(schoon)) {
    if (isValidIsbn13(schoon)) return schoon
    throw new ApiFout(400, 'Dit ISBN-13 is ongeldig (het controlecijfer klopt niet). Controleer of je het goed hebt overgetypt.', { veld: 'isbn' })
  }
  if (/^\d{9}[\dX]$/.test(schoon)) {
    const omgerekend = isbn10to13(schoon)
    if (omgerekend) return omgerekend
    throw new ApiFout(400, 'Dit ISBN-10 is ongeldig (het controlecijfer klopt niet). Controleer of je het goed hebt overgetypt.', { veld: 'isbn' })
  }
  throw new ApiFout(400, 'Een ISBN heeft 10 of 13 tekens (alleen cijfers; bij een ISBN-10 mag het laatste teken een X zijn).', { veld: 'isbn' })
}

// Haalt het boeknummer uit een Goodreads-link (of accepteert alleen het nummer). Dat nummer wordt
// opgeslagen als goodreads_id; de detailpagina maakt er https://www.goodreads.com/book/show/<nummer> van.
function normaliseerGoodreads(waarde) {
  if (waarde == null) return null
  if (typeof waarde !== 'string') throw new ApiFout(400, 'De Goodreads-link moet tekst zijn.', { veld: 'goodreads' })
  const schoon = waarde.trim()
  if (!schoon) return null
  if (/^\d{1,12}$/.test(schoon)) return schoon
  const m = /^(?:https?:\/\/)?(?:[\w-]+\.)?goodreads\.com\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?book\/show\/(\d{1,12})(?!\d)/i.exec(schoon)
  if (m) return m[1]
  throw new ApiFout(400, 'Dit lijkt geen link naar een Goodreads-boekpagina. Plak de link van de boekpagina, bijvoorbeeld https://www.goodreads.com/book/show/5907.The_Hobbit', { veld: 'goodreads' })
}

// Zelfde regel als validate-data.js: echte datum, niet in de toekomst (UTC-middernacht vergeleken met nu).
function valideerDatum(waarde, nu) {
  if (waarde == null || waarde === '') return null
  if (typeof waarde !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(waarde)) {
    throw new ApiFout(400, 'De leesdatum moet de vorm JJJJ-MM-DD hebben.', { veld: 'datum_gelezen' })
  }
  const datum = new Date(`${waarde}T00:00:00Z`)
  if (Number.isNaN(datum.getTime()) || datum.toISOString().slice(0, 10) !== waarde) {
    throw new ApiFout(400, 'Dat is geen bestaande datum.', { veld: 'datum_gelezen' })
  }
  if (datum > nu) throw new ApiFout(400, 'De leesdatum ligt in de toekomst.', { veld: 'datum_gelezen' })
  return waarde
}

function valideerScore(waarde) {
  if (waarde == null || waarde === '') return null
  const getal = typeof waarde === 'string' && /^\d+$/.test(waarde) ? Number(waarde) : waarde
  if (!Number.isInteger(getal) || getal < 1 || getal > 5) {
    throw new ApiFout(400, 'De beoordeling moet een geheel getal van 1 t/m 5 zijn.', { veld: 'score' })
  }
  return getal
}

function valideerInvoer(body, nu) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new ApiFout(400, 'Ongeldige aanvraag.')

  const titel = eenregelig(body.titel, 'titel', 'De titel', MAX_LENGTE.titel)
  if (!titel) throw new ApiFout(400, 'Vul een titel in.', { veld: 'titel' })
  const auteurIngevuld = eenregelig(body.auteur, 'auteur', 'De auteur', MAX_LENGTE.auteur)
  const isbn = normaliseerIsbn(body.isbn)
  const goodreadsId = normaliseerGoodreads(body.goodreads)
  const datum_gelezen = valideerDatum(body.datum_gelezen, nu)
  const score = valideerScore(body.score)
  const notitie = meerregelig(body.notitie, 'notitie', 'De opmerking', MAX_LENGTE.notitie)

  // In jouw datamodel staat een opmerking bij de beoordeling (beoordelingen.json, waar score verplicht is).
  if (notitie && score === null) {
    throw new ApiFout(400, 'Een opmerking wordt samen met een beoordeling opgeslagen. Kies eerst een aantal sterren, of laat de opmerking leeg.', { veld: 'score' })
  }

  let cover = null
  if (body.cover != null && body.cover !== '') {
    if (typeof body.cover !== 'string') throw new ApiFout(400, 'Ongeldige cover.', { veld: 'cover' })
    cover = body.cover
  }

  return {
    titel,
    auteur: auteurIngevuld || ONBEKENDE_AUTEUR,
    auteurOpgegeven: auteurIngevuld !== '',
    isbn,
    goodreadsId,
    datum_gelezen,
    score,
    notitie,
    cover,
    forceer: body.forceer === true,
  }
}

// ---------- Cover ----------

async function standaardLaadSharp() {
  try {
    return (await import('sharp')).default
  } catch {
    return null
  }
}

// Leest een data-URL, controleert dat het écht een afbeelding is en maakt er een verkleinde JPEG van.
// De ruwe upload wordt nooit zelf opgeslagen, alleen het resultaat van sharp.
async function verwerkCover(dataUrl, sharp) {
  const komma = dataUrl.indexOf(',')
  const kop = komma === -1 ? '' : dataUrl.slice(0, komma)
  if (!/^data:image\/[\w.+-]+;base64$/i.test(kop)) {
    throw new ApiFout(400, 'De cover is geen geldige afbeelding.', { veld: 'cover' })
  }
  const invoer = Buffer.from(dataUrl.slice(komma + 1), 'base64')
  if (invoer.length === 0) throw new ApiFout(400, 'De coverafbeelding is leeg.', { veld: 'cover' })
  if (invoer.length > MAX_COVER_BYTES) {
    throw new ApiFout(413, `De coverafbeelding is te groot (maximaal ${MAX_COVER_BYTES / 1024 / 1024} MB).`, { veld: 'cover' })
  }
  if (!sharp) {
    throw new ApiFout(500, 'Het pakket "sharp" (nodig om covers te verkleinen) is niet geïnstalleerd. Draai eerst: npm install', { veld: 'cover' })
  }
  try {
    const meta = await sharp(invoer).metadata()
    if (!TOEGESTANE_FORMATEN.has(meta.format)) throw new Error('formaat niet toegestaan')
    return await sharp(invoer)
      .rotate()
      .resize({ width: COVER_BREEDTE, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: COVER_KWALITEIT, mozjpeg: true })
      .toBuffer()
  } catch {
    throw new ApiFout(400, 'Dit bestand is geen afbeelding die ik kan lezen. Gebruik een JPG, PNG, WebP, GIF of TIFF.', { veld: 'cover' })
  }
}

// ---------- Dubbelen en ids ----------

function titelSleutel(tekst) {
  return String(tekst ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

function samenvatting(boek) {
  return { id: boek.id, titel: boek.titel, auteur: boek.auteur }
}

// Zelfde boek met een andere uitgave heeft een andere ISBN: daarom is een gelijke titel alleen een waarschuwing.
function zoekDubbelOpTitel(gelezen, titel, auteur) {
  const t = titelSleutel(titel)
  if (!t) return null
  const a = auteur ? titelSleutel(auteur) : null
  return gelezen.find((b) => titelSleutel(b.titel) === t && (!a || titelSleutel(b.auteur) === a)) ?? null
}

function volgendeEigenId(gelezen, paden) {
  let n = 1
  for (const b of gelezen) {
    const m = /^eigen-(\d+)$/.exec(b.id ?? '')
    if (m) n = Math.max(n, Number(m[1]) + 1)
  }
  const bezet = (id) =>
    gelezen.some((b) => b.id === id) ||
    fs.existsSync(path.join(paden.coversDir, `${id}-voor.jpg`)) ||
    fs.existsSync(path.join(paden.coversDir, `${id}-achter.jpg`))
  while (bezet(`eigen-${n}`)) n++
  return `eigen-${n}`
}

// Dezelfde volgorde als scripts/import-goodreads.js: laatst gelezen eerst, zonder datum onderaan.
function vergelijk(a, b) {
  if (a.datum_gelezen !== b.datum_gelezen) {
    if (a.datum_gelezen === null) return 1
    if (b.datum_gelezen === null) return -1
    return a.datum_gelezen < b.datum_gelezen ? 1 : -1
  }
  return a.titel.localeCompare(b.titel, 'nl')
}

// ---------- Opslaan ----------

// Draait volledig synchroon (geen await tussen lezen en schrijven), dus twee gelijktijdige aanvragen
// kunnen elkaars wijziging niet overschrijven.
function bewaarBoek({ paden, invoer, coverBuffer, schrijfJson }) {
  const gelezenBestand = leesLijst(paden.gelezen, 'gelezen.json')
  const beoordelingenBestand = leesLijst(paden.beoordelingen, 'beoordelingen.json', { magOntbreken: true })
  const gelezen = gelezenBestand.lijst
  const beoordelingen = beoordelingenBestand.lijst

  // 1. Dubbelen
  if (invoer.isbn) {
    const dubbel = gelezen.find((b) => b.id === invoer.isbn || b.isbn === invoer.isbn)
    if (dubbel) {
      throw new ApiFout(409, `Dit ISBN staat al in je collectie: “${dubbel.titel}” van ${dubbel.auteur}.`, {
        soort: 'isbn-dubbel',
        kanForceren: false,
        bestaand: samenvatting(dubbel),
      })
    }
  }
  if (invoer.goodreadsId) {
    const dubbel = gelezen.find((b) => b.goodreads_id === invoer.goodreadsId)
    if (dubbel) {
      throw new ApiFout(409, `Deze Goodreads-link hoort al bij een boek in je collectie: “${dubbel.titel}” van ${dubbel.auteur}.`, {
        soort: 'goodreads-dubbel',
        kanForceren: false,
        bestaand: samenvatting(dubbel),
      })
    }
  }
  if (!invoer.forceer) {
    const dubbel = zoekDubbelOpTitel(gelezen, invoer.titel, invoer.auteurOpgegeven ? invoer.auteur : null)
    if (dubbel) {
      throw new ApiFout(
        409,
        `Er staat al een boek met deze titel in je collectie: “${dubbel.titel}” van ${dubbel.auteur}. Is dit een ander boek, bijvoorbeeld een andere uitgave? Dan kun je het toch toevoegen.`,
        { soort: 'titel-dubbel', kanForceren: true, bestaand: samenvatting(dubbel) },
      )
    }
  }

  // 2. Id en bestaande bestanden
  const id = invoer.isbn ?? volgendeEigenId(gelezen, paden)
  const coverPad = path.join(paden.coversDir, `${id}-voor.jpg`)
  if (coverBuffer && fs.existsSync(coverPad)) {
    throw new ApiFout(
      409,
      `Er staat al een coverbestand voor dit boek (public/covers/${id}-voor.jpg). Dat bestand blijft onaangetast. Voeg het boek toe zonder cover om die bestaande cover te gebruiken.`,
      { soort: 'cover-bestaat', veld: 'cover' },
    )
  }
  const bestaandeBeoordeling = beoordelingen.find((r) => r.id === id) ?? null
  if (bestaandeBeoordeling && invoer.score !== null) {
    throw new ApiFout(409, `Er bestaat al een beoordeling voor id ${id}. Die wordt niet overschreven.`, { veld: 'score' })
  }

  // 3. Nieuwe regels opbouwen (alleen toevoegen, niets wijzigen)
  const boek = { id }
  if (invoer.isbn) boek.isbn = invoer.isbn
  if (invoer.goodreadsId) boek.goodreads_id = invoer.goodreadsId
  boek.titel = invoer.titel
  boek.auteur = invoer.auteur
  boek.datum_gelezen = invoer.datum_gelezen

  let beoordeling = bestaandeBeoordeling
  let nieuweBeoordelingen = null
  if (invoer.score !== null) {
    beoordeling = { id, score: invoer.score, favoriet: false }
    if (invoer.notitie) beoordeling.notitie = invoer.notitie
    nieuweBeoordelingen = [...beoordelingen, beoordeling]
  }

  const positie = gelezen.findIndex((b) => vergelijk(boek, b) < 0)
  const nieuweGelezen = positie === -1 ? [...gelezen, boek] : [...gelezen.slice(0, positie), boek, ...gelezen.slice(positie)]

  // 4. Schrijven, met terugdraaien als er iets misgaat
  const waarschuwingen = []
  let coverGeschreven = false
  let gelezenGeschreven = false
  let beoordelingenGeschreven = false
  try {
    if (coverBuffer) {
      fs.mkdirSync(paden.coversDir, { recursive: true })
      fs.writeFileSync(coverPad, coverBuffer, { flag: 'wx' })
      coverGeschreven = true
    }
    schrijfJson(paden.gelezen, nieuweGelezen)
    gelezenGeschreven = true
    if (nieuweBeoordelingen) {
      schrijfJson(paden.beoordelingen, nieuweBeoordelingen)
      beoordelingenGeschreven = true
    }
  } catch (e) {
    const problemen = []
    const herstel = (bestand, tekst) => {
      try {
        schrijfTekstAtomisch(bestand, tekst)
      } catch (e2) {
        problemen.push(`${path.basename(bestand)}: ${e2.message}`)
      }
    }
    if (beoordelingenGeschreven) herstel(paden.beoordelingen, beoordelingenBestand.tekst)
    if (gelezenGeschreven) herstel(paden.gelezen, gelezenBestand.tekst)
    if (coverGeschreven) fs.rmSync(coverPad, { force: true })
    if (problemen.length) {
      throw new ApiFout(500, `Opslaan mislukt (${e.message}) én terugzetten mislukt voor: ${problemen.join('; ')}. Controleer src/data met git.`)
    }
    throw new ApiFout(500, `Opslaan mislukt: ${e.message}. Er is niets gewijzigd.`)
  }

  // 5. covers.json bijwerken (gegenereerd bestand; mislukken is geen ramp)
  const covers = scanCovers(paden)
  try {
    const nieuweTekst = JSON.stringify(covers, null, 2) + '\n'
    const huidig = fs.existsSync(paden.coversJson) ? fs.readFileSync(paden.coversJson, 'utf8') : null
    if (huidig !== nieuweTekst) schrijfJson(paden.coversJson, covers)
  } catch {
    waarschuwingen.push('Het boek is opgeslagen, maar covers.json kon niet worden bijgewerkt. Draai: npm run covers')
  }

  return { ok: true, boek, beoordeling, covers: covers[id] ?? null, waarschuwingen }
}

function werkBoekBij({ paden, id, invoer, coverBuffer, coverAction, schrijfJson, nu }) {
  const gelezenBestand = leesLijst(paden.gelezen, 'gelezen.json')
  const beoordelingenBestand = leesLijst(paden.beoordelingen, 'beoordelingen.json', { magOntbreken: true })
  const gelezen = gelezenBestand.lijst
  const beoordelingen = beoordelingenBestand.lijst
  const index = gelezen.findIndex((boek) => boek.id === id)
  if (index === -1) throw new ApiFout(404, 'Boek niet gevonden.')

  const bestaand = gelezen[index]
  const oudeBeoordeling = beoordelingen.find((regel) => regel.id === id) ?? null
  const vervangendeBody = {
    titel: invoer.titel ?? bestaand.titel,
    auteur: invoer.auteur ?? bestaand.auteur,
    isbn: invoer.isbn ?? bestaand.isbn ?? null,
    goodreads: invoer.goodreads ?? (bestaand.goodreads_id ? String(bestaand.goodreads_id) : ''),
    datum_gelezen: invoer.datum_gelezen ?? bestaand.datum_gelezen ?? null,
    score: invoer.score ?? (oudeBeoordeling?.score ?? null),
    notitie: invoer.notitie ?? (oudeBeoordeling?.notitie ?? ''),
    cover: invoer.cover ?? null,
    forceer: false,
  }

  const valideer = valideerInvoer(vervangendeBody, nu())
  const coverPad = path.join(paden.coversDir, `${id}-voor.jpg`)

  if (coverAction === 'remove') {
    if (fs.existsSync(coverPad)) fs.rmSync(coverPad, { force: true })
  } else if (coverBuffer) {
    fs.mkdirSync(paden.coversDir, { recursive: true })
    if (fs.existsSync(coverPad) && coverAction !== 'replace') {
      throw new ApiFout(409, `Er staat al een coverbestand voor dit boek. Gebruik replace om te vervangen.`, { veld: 'cover', soort: 'cover-bestaat' })
    }
    fs.writeFileSync(coverPad, coverBuffer)
  }

  const boek = {
    ...bestaand,
    titel: valideer.titel,
    auteur: valideer.auteur,
    datum_geleken: valideer.datum_gelezen,
  }
  if (valideer.isbn) boek.isbn = valideer.isbn
  else delete boek.isbn
  if (valideer.goodreadsId) boek.goodreads_id = valideer.goodreadsId
  else delete boek.goodreads_id
  boek.datum_gelezen = valideer.datum_gelezen

  const volgendeGelezen = [...gelezen]
  volgendeGelezen[index] = boek

  const nieuweBeoordelingen = [...beoordelingen.filter((regel) => regel.id !== id)]
  if (valideer.score !== null) {
    const scoreRecord = { id, score: valideer.score, favoriet: oudeBeoordeling?.favoriet ?? false }
    if (valideer.notitie) scoreRecord.notitie = valideer.notitie
    nieuweBeoordelingen.push(scoreRecord)
  }

  try {
    schrijfJson(paden.gelezen, volgendeGelezen)
    schrijfJson(paden.beoordelingen, nieuweBeoordelingen)
    const covers = scanCovers(paden)
    const nieuweTekst = JSON.stringify(covers, null, 2) + '\n'
    const huidig = fs.existsSync(paden.coversJson) ? fs.readFileSync(paden.coversJson, 'utf8') : null
    if (huidig !== nieuweTekst) schrijfJson(paden.coversJson, covers)

    const beoordeling = nieuweBeoordelingen.find((regel) => regel.id === id) ?? null
    return { ok: true, boek, beoordeling, covers: covers[id] ?? null }
  } catch (e) {
    throw new ApiFout(500, `Opslaan mislukt: ${e.message}. Er is niets gewijzigd.`)
  }
}

// ---------- HTTP ----------

function stuurJson(res, status, data) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(data))
}

function normaliseerBasis(basis) {
  let b = basis || '/'
  if (!b.startsWith('/')) b = `/${b}`
  if (!b.endsWith('/')) b += '/'
  return b
}

// Tegen "DNS rebinding": alleen aanvragen die via localhost binnenkomen.
function controleerHost(req) {
  let hostnaam = ''
  try {
    hostnaam = new URL(`http://${req.headers.host ?? ''}`).hostname
  } catch {
    /* leeg = geweigerd */
  }
  const lokaal = hostnaam === 'localhost' || hostnaam.endsWith('.localhost') || hostnaam === '[::1]' || /^127(\.\d{1,3}){3}$/.test(hostnaam)
  if (!lokaal) throw new ApiFout(403, 'Boeken toevoegen kan alleen via localhost (of 127.0.0.1).')
}

// Tegen aanvragen vanaf andere websites: alleen JSON (dat vereist een CORS-preflight, die wij nooit toestaan)
// en een eventuele Origin moet gelijk zijn aan de host waarop de website draait.
function controleerHerkomst(req) {
  const type = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  if (type !== 'application/json') throw new ApiFout(415, 'Verwacht application/json.')
  const origin = req.headers.origin
  if (origin) {
    let originHost = null
    try {
      originHost = new URL(origin).host
    } catch {
      /* ongeldig = geweigerd */
    }
    if (originHost !== req.headers.host) throw new ApiFout(403, 'Aanvraag van een andere herkomst geweigerd.')
  }
}

function leesJsonBody(req) {
  return new Promise((resolve, reject) => {
    const delen = []
    let totaal = 0
    let teGroot = false
    req.on('data', (stuk) => {
      totaal += stuk.length
      if (totaal > MAX_BODY_BYTES) {
        teGroot = true
        delen.length = 0
      } else if (!teGroot) {
        delen.push(stuk)
      }
    })
    req.on('end', () => {
      if (teGroot) {
        return reject(new ApiFout(413, `De aanvraag is te groot (maximaal ${MAX_BODY_BYTES / 1024 / 1024} MB). Kies een kleinere coverafbeelding.`, { veld: 'cover' }))
      }
      try {
        resolve(JSON.parse(Buffer.concat(delen).toString('utf8')))
      } catch {
        reject(new ApiFout(400, 'De aanvraag bevat geen geldige JSON.'))
      }
    })
    req.on('error', reject)
    req.on('close', () => reject(new ApiFout(400, 'De verbinding is verbroken.')))
  })
}

// Maakt de request-handler (connect/Vite-stijl: (req, res, next)). Houdt zelf geen toestand bij:
// alles wordt bij elke aanvraag vers van schijf gelezen, dus een herstart verliest niets.
export function maakBoekApi({
  root,
  basis = '/',
  laadSharp = standaardLaadSharp,
  schrijfJson = schrijfJsonAtomisch,
  nu = () => new Date(),
}) {
  const paden = padenVoor(root)
  const voorvoegsel = `${normaliseerBasis(basis)}api/`

  return async function boekApi(req, res, next) {
    let url
    try {
      url = new URL(req.originalUrl ?? req.url, 'http://localhost')
    } catch {
      return next()
    }
    if (!url.pathname.startsWith(voorvoegsel)) return next()
    const route = url.pathname.slice(voorvoegsel.length)

    try {
      controleerHost(req)

      if (req.method === 'GET' && route === 'status') {
        return stuurJson(res, 200, { ok: true, boekenApi: true })
      }
      if (req.method === 'POST' && route === 'boeken') {
        controleerHerkomst(req)
        const invoer = valideerInvoer(await leesJsonBody(req), nu())
        const coverBuffer = invoer.cover ? await verwerkCover(invoer.cover, await laadSharp()) : null
        return stuurJson(res, 201, bewaarBoek({ paden, invoer, coverBuffer, schrijfJson }))
      }
      if (req.method === 'PUT' && route.startsWith('boeken/')) {
        controleerHerkomst(req)
        const id = decodeURIComponent(route.slice('boeken/'.length))
        const body = await leesJsonBody(req)
        const coverAction = body?.coverAction ?? 'keep'
        const coverBuffer = body?.cover ? await verwerkCover(body.cover, await laadSharp()) : null
        const resultaat = werkBoekBij({ paden, id, invoer: body, coverBuffer, coverAction, schrijfJson, nu })
        return stuurJson(res, 200, { ok: true, ...resultaat })
      }
      throw new ApiFout(404, 'Onbekend API-pad.')
    } catch (e) {
      if (e instanceof ApiFout) return stuurJson(res, e.status, { ok: false, fout: e.message, ...e.extra })
      console.error('[boeken-api] onverwachte fout:', e)
      return stuurJson(res, 500, { ok: false, fout: 'Onverwachte fout bij het opslaan. Details staan in de terminal.' })
    }
  }
}
