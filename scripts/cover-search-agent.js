
import fs from 'node:fs'
import path from 'node:path'

const CSV = './boeken-zonder-voorkant.csv'
const INBOX = './covers-inbox'
const COVERS_FILE = './src/data/covers.json'
const LIMIT = Math.max(1, Number(process.env.LIMIT || 1))
const PAUZE_MS = 1800

function slaap(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseCSV(regel) {
  const velden = []
  let veld = ''
  let aanhalingstekens = false

  for (let i = 0; i < regel.length; i++) {
    const c = regel[i]
    if (c === '"') {
      if (aanhalingstekens && regel[i + 1] === '"') {
        veld += '"'
        i++
      } else {
        aanhalingstekens = !aanhalingstekens
      }
    } else if (c === ';' && !aanhalingstekens) {
      velden.push(veld)
      veld = ''
    } else {
      veld += c
    }
  }

  velden.push(veld)
  return velden
}

function normaal(tekst) {
  return String(tekst || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function veiligeTitel(titel) {
  return String(titel || 'onbekend boek')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 150)
    .replace(/[. ]+$/, '') || 'onbekend boek'
}

function isbnSchoon(isbn) {
  return String(isbn || '').replace(/[^0-9Xx]/g, '').toUpperCase()
}

function geldigeISBN(isbn) {
  return /^\d{13}$/.test(isbn) || /^\d{9}[\dX]$/.test(isbn)
}

function jpeg(data) {
  return data.length > 3 &&
    data[0] === 0xff &&
    data[1] === 0xd8 &&
    data[2] === 0xff
}

async function ophalen(url, timeout = 20000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/*,*/*;q=0.8',
        'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.8'
      }
    })
  } finally {
    clearTimeout(timer)
  }
}

function htmlOntsnappen(tekst) {
  return String(tekst || '')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, '/')
    .replace(/\\u002F/g, '/')
    .replace(/\\\//g, '/')
}

function afbeeldingsURLs(html) {
  const tekst = htmlOntsnappen(html)
  const urls = new Set()

  // Bol.com gebruikt onder meer media.s-bol.com/.../833x1200.jpg.
  const patronen = [
    /https?:\\?\/\\?\/media\.s-bol\.com\/[^"'\\\s<>]+?\.(?:jpg|jpeg)(?:\?[^"'\\\s<>]*)?/gi,
    /(?:https?:)?\\?\/\\?\/media\.s-bol\.com\/[^"'\\\s<>]+?\.(?:jpg|jpeg)(?:\?[^"'\\\s<>]*)?/gi
  ]

  for (const patroon of patronen) {
    for (const match of tekst.matchAll(patroon)) {
      let url = match[0].replace(/\\\//g, '/').replace(/\\u002F/g, '/')
      url = url.replace(/[\\]+$/g, '').replace(/[),;]+$/g, '')
      if (url.startsWith('//')) url = `https:${url}`
      if (url.startsWith('https://media.s-bol.com/')) urls.add(url)
    }
  }

  return [...urls]
}

function titelScore(gezocht, gevonden) {
  const stop = new Set(['de', 'het', 'een', 'en', 'van', 'voor', 'met', 'in', 'op'])
  const woorden = normaal(gezocht).split(' ')
    .filter(w => w.length > 2 && !stop.has(w))

  if (!woorden.length) return 0

  const titel = normaal(gevonden)
  return woorden.filter(w => titel.includes(w)).length / woorden.length
}

async function bolZoeken(zoekterm) {
  const url = new URL('https://www.bol.com/nl/nl/s/')
  url.searchParams.set('searchtext', zoekterm)

  try {
    const response = await ophalen(url.toString())
    console.log(`   Bol.com HTTP-status: ${response.status}`)
    if (!response.ok) return null

    const html = await response.text()
    if (/captcha|access denied|robot check/i.test(html) &&
        !/media\.s-bol\.com/i.test(html)) {
      console.log('   Bol.com lijkt de aanvraag te blokkeren.')
      return null
    }

    return html
  } catch (fout) {
    console.log(`   Bol.com-aanvraag mislukt: ${fout.message}`)
    return null
  }
}

async function downloadJpeg(url) {
  try {
    const response = await ophalen(url)
    if (!response.ok) return null

    const type = response.headers.get('content-type') || ''
    if (!type.toLowerCase().startsWith('image/')) return null

    const buffer = Buffer.from(await response.arrayBuffer())
    if (!jpeg(buffer) || buffer.length < 2000) return null

    return buffer
  } catch {
    return null
  }
}

async function bolAfbeelding(boek) {
  const isbn = isbnSchoon(boek.isbn)
  const titel = String(boek.titel || '').trim()
  const auteur = String(boek.auteur || '').trim()

  const zoektermen = []
  if (geldigeISBN(isbn)) zoektermen.push(isbn)
  if (titel && auteur && !/unknown author|onbekend/i.test(auteur)) {
    zoektermen.push(`${titel} ${auteur}`)
  }
  if (titel && !zoektermen.includes(titel)) zoektermen.push(titel)

  for (const zoekterm of zoektermen) {
    console.log(`   Zoeken bij Bol.com: ${zoekterm}`)
    const html = await bolZoeken(zoekterm)
    if (!html) {
      await slaap(PAUZE_MS)
      continue
    }

    const urls = afbeeldingsURLs(html)
    console.log(`   Afbeeldingsadressen gevonden: ${urls.length}`)

    // Bij ISBN-zoekopdrachten proberen we de eerste resultaatomslagen.
    // Bij titelzoekopdrachten is de best passende titel extra belangrijk;
    // de HTML van Bol.com bevat niet altijd voldoende metadata om dat
    // automatisch met zekerheid vast te stellen.
    for (const url of urls.slice(0, 8)) {
      const buffer = await downloadJpeg(url)
      if (buffer) {
        return { buffer, bron: 'Bol.com', url }
      }
    }

    await slaap(PAUZE_MS)
  }

  return null
}

function bestandsnaam(titel) {
  const basis = veiligeTitel(titel)
  let doel = path.join(INBOX, `${basis}.jpg`)
  let nummer = 2

  while (fs.existsSync(doel)) {
    doel = path.join(INBOX, `${basis} (${nummer}).jpg`)
    nummer++
  }

  return doel
}

async function main() {
  if (!fs.existsSync(CSV)) {
    console.error(`CSV niet gevonden: ${CSV}`)
    process.exitCode = 1
    return
  }

  fs.mkdirSync(INBOX, { recursive: true })

  const regels = fs.readFileSync(CSV, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(regel => regel.trim())

  if (regels.length < 2) {
    console.log('Geen boeken in de CSV gevonden.')
    return
  }

  const koppen = parseCSV(regels[0])
  const boeken = regels.slice(1).map(regel => {
    const velden = parseCSV(regel)
    return Object.fromEntries(koppen.map((kop, i) => [kop, velden[i] || '']))
  }).filter(boek => boek.titel)

  let bestaandeCovers = {}
  if (fs.existsSync(COVERS_FILE)) {
    try {
      bestaandeCovers = JSON.parse(fs.readFileSync(COVERS_FILE, 'utf8'))
    } catch {
      console.error(`STOP: ${COVERS_FILE} kan niet worden gelezen als JSON.`)
      process.exitCode = 1
      return
    }
  }

  let gevonden = 0
  let mislukt = 0
  let verwerkt = 0
  let overgeslagen = 0

  console.log(`\nBoeken in zoeklijst: ${boeken.length}`)
  console.log(`Deze ronde maximaal: ${LIMIT}`)
  console.log(`Opslagmap: ${INBOX}\n`)

  for (const boek of boeken) {
    if (verwerkt >= LIMIT) break

    const titelNormaal = normaal(boek.titel)
    const bestaatAl = fs.readdirSync(INBOX).some(bestand =>
      /\.(jpe?g)$/i.test(bestand) &&
      normaal(path.parse(bestand).name.replace(/\s+\(\d+\)$/, '')) === titelNormaal
    )
    const isbn = isbnSchoon(boek.isbn)
    const heeftGeregistreerdeCover =
      geldigeISBN(isbn) &&
      Object.prototype.hasOwnProperty.call(bestaandeCovers, isbn) &&
      bestaandeCovers[isbn]?.voor === true

    if (bestaatAl || heeftGeregistreerdeCover) {
      overgeslagen++
      continue
    }

    verwerkt++
    console.log(`[${verwerkt}/${LIMIT}] ${boek.titel}`)
    console.log(`   ISBN: ${boek.isbn || 'geen'}`)

    const resultaat = await bolAfbeelding(boek)

    if (resultaat) {
      const doel = bestandsnaam(boek.titel)
      fs.writeFileSync(doel, resultaat.buffer)
      gevonden++
      console.log(`   ✓ Omslag opgeslagen: ${doel}`)
      console.log(`   Bron: ${resultaat.bron}`)
    } else {
      mislukt++
      console.log('   – Geen bruikbare omslag gevonden')
    }

    await slaap(PAUZE_MS)
  }

  console.log('\n------------------------------')
  console.log(`Verwerkt: ${verwerkt}`)
  console.log(`Overgeslagen (omslag al aanwezig): ${overgeslagen}`)
  console.log(`Omslagen gevonden: ${gevonden}`)
  console.log(`Niet gevonden: ${mislukt}`)
  console.log('------------------------------\n')
}

main().catch(fout => {
  console.error('Zoekagent gestopt:', fout.message)
  process.exitCode = 1
})
