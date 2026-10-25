// Tests voor server/boek-api.js. Draaien: npm test
//
// Elke test maakt een TIJDELIJK mini-project (nooit je echte src/data) en start de API daarvoor op een
// willekeurige poort. Alle aanvragen gaan via echte HTTP. De covertests hebben "sharp" nodig (staat in
// je devDependencies); is dat niet geïnstalleerd, dan worden alleen die tests overgeslagen.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { maakBoekApi, schrijfJsonAtomisch, ONBEKENDE_AUTEUR } from './boek-api.js'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASIS = '/boekenwebsite/'

let sharp = null
try {
  sharp = (await import('sharp')).default
} catch {
  /* covertests worden overgeslagen */
}
const nodigSharp = { skip: !sharp && 'sharp is niet geïnstalleerd (npm install)' }

// ---------- Testdata ----------

function metControlecijfer(twaalf) {
  let som = 0
  for (let i = 0; i < 12; i++) som += Number(twaalf[i]) * (i % 2 === 0 ? 1 : 3)
  return twaalf + String((10 - (som % 10)) % 10)
}
const ISBN_NIEUW = '9780306406157' // 0-306-40615-2 als ISBN-10
const ISBN_NIEUW_10 = '0-306-40615-2'
const ISBN_WEES = metControlecijfer('978013110362') // heeft wel een cover, maar geen boek (zie fixture)
const ISBN_TWEE = '9789022592687' // al aanwezig als BOEK_C

const BOEK_A = { id: '9780261102217', isbn: '9780261102217', goodreads_id: '5907', titel: 'The Hobbit', auteur: 'J.R.R. Tolkien', datum_gelezen: '2025-11-02', paginas: 310, jaar_origineel: 1937 }
const BOEK_B = { id: 'gr-777', goodreads_id: '777', titel: 'Boek zonder ISBN', auteur: 'Ergens Iemand', datum_gelezen: '2024-05-01' }
const BOEK_C = { id: ISBN_TWEE, isbn: ISBN_TWEE, goodreads_id: '123', titel: 'Wat zou Dolly doen', auteur: 'Ruth Dolly', datum_gelezen: null }
const BEOORDELING_A = { id: BOEK_A.id, score: 5, favoriet: true, notitie: 'Prachtig.' }
const BESTAANDE_COVER_A = 'BESTAANDE-COVER-A'
const WEES_COVER = 'WEES-COVER-ZONDER-BOEK'

const json = (data) => JSON.stringify(data, null, 2) + '\n'

function maakProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boeken-test-'))
  fs.mkdirSync(path.join(root, 'src/data'), { recursive: true })
  fs.mkdirSync(path.join(root, 'public/covers'), { recursive: true })
  fs.writeFileSync(path.join(root, 'package.json'), '{ "type": "module" }\n')
  fs.cpSync(path.join(REPO, 'scripts'), path.join(root, 'scripts'), { recursive: true }) // voor de echte validator
  fs.writeFileSync(path.join(root, 'src/data/gelezen.json'), json([BOEK_A, BOEK_B, BOEK_C]))
  fs.writeFileSync(path.join(root, 'src/data/beoordelingen.json'), json([BEOORDELING_A]))
  fs.writeFileSync(path.join(root, `public/covers/${BOEK_A.id}-voor.jpg`), BESTAANDE_COVER_A)
  fs.writeFileSync(path.join(root, `public/covers/${ISBN_WEES}-voor.jpg`), WEES_COVER)
  fs.writeFileSync(path.join(root, 'src/data/covers.json'), json({ [ISBN_WEES]: { voor: true }, [BOEK_A.id]: { voor: true } }))
  return root
}

async function startServer(root, opties = {}) {
  const api = maakBoekApi({ root, basis: BASIS, ...opties })
  const server = http.createServer((req, res) => api(req, res, () => { res.statusCode = 404; res.end('geen-api') }))
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  return {
    port,
    url: `http://127.0.0.1:${port}${BASIS}api/`,
    stop: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r) }),
  }
}

async function metProject(fn, opties) {
  const root = maakProject()
  const server = await startServer(root, opties)
  try {
    await fn({ root, server })
  } finally {
    await server.stop()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

async function post(server, body) {
  const antwoord = await fetch(`${server.url}boeken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
  return { status: antwoord.status, data: await antwoord.json() }
}

async function patch(server, id, wijzigingen, origineel, extra = {}) {
  const antwoord = await fetch(`${server.url}boeken/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wijzigingen, origineel, ...extra }),
  })
  return { status: antwoord.status, data: await antwoord.json() }
}

// Ruwe aanvraag, voor tests waarbij we headers (Host, Origin) zelf willen bepalen.
function ruw(server, { method = 'GET', pad = 'status', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: server.port, method, path: `${BASIS}api/${pad}`, headers }, (res) => {
      let tekst = ''
      res.on('data', (d) => (tekst += d))
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(tekst) }))
    })
    req.on('error', reject)
    req.end(body)
  })
}

function momentopname(root) {
  const lees = (p) => (fs.existsSync(path.join(root, p)) ? fs.readFileSync(path.join(root, p), 'utf8') : null)
  const covers = {}
  const dir = path.join(root, 'public/covers')
  for (const naam of fs.readdirSync(dir).sort()) covers[naam] = createHash('sha256').update(fs.readFileSync(path.join(dir, naam))).digest('hex')
  const gelezenTekst = lees('src/data/gelezen.json')
  const beoordelingenTekst = lees('src/data/beoordelingen.json')
  let gelezen = null
  let beoordelingen = null
  try { gelezen = JSON.parse(gelezenTekst) } catch { /* test bekijkt de tekst */ }
  try { beoordelingen = JSON.parse(beoordelingenTekst) } catch { /* idem */ }
  return { gelezenTekst, beoordelingenTekst, coversJsonTekst: lees('src/data/covers.json'), covers, gelezen, beoordelingen }
}

function assertOnveranderd(voor, na) {
  assert.equal(na.gelezenTekst, voor.gelezenTekst, 'gelezen.json is gewijzigd')
  assert.equal(na.beoordelingenTekst, voor.beoordelingenTekst, 'beoordelingen.json is gewijzigd')
  assert.equal(na.coversJsonTekst, voor.coversJsonTekst, 'covers.json is gewijzigd')
  assert.deepEqual(na.covers, voor.covers, 'coverbestanden zijn gewijzigd')
}

const maakPng = (b, h) => sharp({ create: { width: b, height: h, channels: 3, background: { r: 200, g: 40, b: 40 } } }).png().toBuffer()
const dataUrl = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`

// ---------- Status en beveiliging ----------

test('status: bereikbaar via localhost, en andere paden gaan door naar de rest van de site', async () => {
  await metProject(async ({ server }) => {
    const status = await fetch(`${server.url}status`)
    assert.equal(status.status, 200)
    assert.deepEqual(await status.json(), { ok: true, boekenApi: true })
    const rest = await fetch(`http://127.0.0.1:${server.port}${BASIS}boeken`)
    assert.equal(await rest.text(), 'geen-api')
  })
})

test('beveiliging: aanvragen via een andere Host (DNS-rebinding) worden geweigerd', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const status = await ruw(server, { headers: { Host: 'evil.example' } })
    assert.equal(status.status, 403)
    assert.notEqual(status.data.boekenApi, true)
    const schrijf = await ruw(server, { method: 'POST', pad: 'boeken', headers: { Host: 'evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: 'X' }) })
    assert.equal(schrijf.status, 403)
    assertOnveranderd(voor, momentopname(root))
  })
})

test('beveiliging: aanvraag vanaf een andere website (Origin) of zonder JSON-type wordt geweigerd', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const body = JSON.stringify({ titel: 'Via andere website' })
    const andereOrigin = await ruw(server, { method: 'POST', pad: 'boeken', headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body })
    assert.equal(andereOrigin.status, 403)
    const platteTekst = await ruw(server, { method: 'POST', pad: 'boeken', headers: { 'Content-Type': 'text/plain' }, body })
    assert.equal(platteTekst.status, 415)
    assertOnveranderd(voor, momentopname(root))
    // Een gewone browseraanvraag vanaf de website zelf (Origin = zelfde host) werkt wel.
    const zelfde = await ruw(server, { method: 'POST', pad: 'boeken', headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${server.port}` }, body })
    assert.equal(zelfde.status, 201)
  })
})

test('ongeldige JSON en te grote aanvragen worden netjes geweigerd', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    assert.equal((await post(server, '{dit is geen json')).status, 400)
    const groot = await post(server, JSON.stringify({ titel: 'Groot', notitie: 'x'.repeat(26 * 1024 * 1024) }))
    assert.equal(groot.status, 413)
    assertOnveranderd(voor, momentopname(root))
  })
})

// ---------- Opslaan ----------

test('alleen een titel: boek zonder cover, ISBN, auteur en datum wordt opgeslagen (id eigen-1)', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const { status, data } = await post(server, { titel: 'Alleen een titel' })
    assert.equal(status, 201)
    assert.deepEqual(data.boek, { id: 'eigen-1', titel: 'Alleen een titel', auteur: ONBEKENDE_AUTEUR, datum_gelezen: null })
    assert.equal(data.beoordeling, null)
    assert.equal(data.covers, null)

    const na = momentopname(root)
    // Op de juiste plek (zelfde volgorde als de import: zonder datum onderaan, op titel) en exact canoniek opgemaakt.
    assert.equal(na.gelezenTekst, json([BOEK_A, BOEK_B, data.boek, BOEK_C]))
    assert.equal(na.beoordelingenTekst, voor.beoordelingenTekst, 'zonder beoordeling blijft beoordelingen.json ongemoeid')
    assert.deepEqual(na.covers, voor.covers)
  })
})

test('bestaande boeken en beoordelingen blijven onveranderd als er een boek bijkomt', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const { data } = await post(server, { titel: 'Nieuw met beoordeling', auteur: 'Nieuwe Auteur', datum_gelezen: '2026-02-01', score: 3, notitie: 'Redelijk.' })
    const na = momentopname(root)
    assert.deepEqual(na.gelezen.filter((b) => b.id !== data.boek.id), voor.gelezen, 'bestaande boeken zijn gewijzigd')
    assert.deepEqual(na.beoordelingen.slice(0, voor.beoordelingen.length), voor.beoordelingen, 'bestaande beoordelingen zijn gewijzigd')
    assert.deepEqual(na.beoordelingen.at(-1), { id: data.boek.id, score: 3, favoriet: false, notitie: 'Redelijk.' })
    assert.equal(na.gelezen.length, voor.gelezen.length + 1)
  })
})

test('volledig boek: ISBN met streepjes, beoordeling, opmerking en cover (verkleind naar 600 px JPEG)', nodigSharp, async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const png = await maakPng(1200, 1800)
    const { status, data } = await post(server, {
      titel: 'Volledig boek', auteur: 'Volle Auteur', isbn: '978-0-306-40615-7', datum_gelezen: '2026-01-15',
      score: 4, notitie: 'Eerste regel\nTweede regel', cover: dataUrl(png),
    })
    assert.equal(status, 201)
    assert.equal(data.boek.id, ISBN_NIEUW)
    assert.equal(data.boek.isbn, ISBN_NIEUW)
    assert.deepEqual(data.covers, { voor: true })

    const coverPad = path.join(root, `public/covers/${ISBN_NIEUW}-voor.jpg`)
    const meta = await sharp(coverPad).metadata()
    assert.deepEqual([meta.format, meta.width, meta.height], ['jpeg', 600, 900], 'cover moet een 600x900 JPEG zijn')

    const na = momentopname(root)
    assert.equal(na.gelezen[0].id, ISBN_NIEUW, 'nieuwste leesdatum hoort bovenaan')
    assert.deepEqual(na.beoordelingen.at(-1), { id: ISBN_NIEUW, score: 4, favoriet: false, notitie: 'Eerste regel\nTweede regel' })
    assert.deepEqual(JSON.parse(na.coversJsonTekst)[ISBN_NIEUW], { voor: true })
    // Bestaande covers: byte-voor-byte hetzelfde.
    assert.equal(na.covers[`${BOEK_A.id}-voor.jpg`], voor.covers[`${BOEK_A.id}-voor.jpg`])
    assert.equal(na.covers[`${ISBN_WEES}-voor.jpg`], voor.covers[`${ISBN_WEES}-voor.jpg`])
  })
})

test('ISBN-10 wordt omgerekend naar ISBN-13', async () => {
  await metProject(async ({ server }) => {
    const { status, data } = await post(server, { titel: 'Tien', isbn: ISBN_NIEUW_10 })
    assert.equal(status, 201)
    assert.equal(data.boek.id, ISBN_NIEUW)
  })
})

test('boeken zonder ISBN krijgen oplopende eigen-ids en slaan ids over waar al een cover bij staat', async () => {
  await metProject(async ({ root, server }) => {
    fs.writeFileSync(path.join(root, 'public/covers/eigen-3-voor.jpg'), 'ALLEEN-EEN-COVER')
    const a = await post(server, { titel: 'Eerste eigen' })
    const b = await post(server, { titel: 'Tweede eigen' })
    const c = await post(server, { titel: 'Derde eigen' })
    assert.deepEqual([a.data.boek.id, b.data.boek.id, c.data.boek.id], ['eigen-1', 'eigen-2', 'eigen-4'])
    assert.equal(fs.readFileSync(path.join(root, 'public/covers/eigen-3-voor.jpg'), 'utf8'), 'ALLEEN-EEN-COVER')
  })
})

// ---------- Invoer controleren ----------

test('titel is verplicht', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const titel of ['', '   ', undefined, null]) {
      const { status, data } = await post(server, { titel })
      assert.equal(status, 400)
      assert.equal(data.veld, 'titel')
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('ongeldige invoer wordt geweigerd en laat alles ongemoeid', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const gevallen = [
      [{ titel: 'T', isbn: '9780306406158' }, 'isbn'], // controlecijfer klopt niet
      [{ titel: 'T', isbn: '12345' }, 'isbn'],
      [{ titel: 'T', datum_gelezen: '2999-01-01' }, 'datum_gelezen'], // toekomst
      [{ titel: 'T', datum_gelezen: '2026-02-30' }, 'datum_gelezen'], // bestaat niet
      [{ titel: 'T', datum_gelezen: '15-01-2026' }, 'datum_gelezen'], // verkeerd formaat
      [{ titel: 'T', score: 6 }, 'score'],
      [{ titel: 'T', score: 0.5 }, 'score'],
      [{ titel: 'T', notitie: 'Zonder beoordeling' }, 'score'], // opmerking hoort bij een beoordeling
      [{ titel: 'x'.repeat(301) }, 'titel'],
    ]
    for (const [invoer, veld] of gevallen) {
      const { status, data } = await post(server, invoer)
      assert.equal(status, 400, JSON.stringify(invoer))
      assert.equal(data.veld, veld, JSON.stringify(invoer))
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('de leesdatum van vandaag (UTC) wordt geaccepteerd', async () => {
  await metProject(async ({ server }) => {
    const vandaag = new Date().toISOString().slice(0, 10)
    assert.equal((await post(server, { titel: 'Vandaag gelezen', datum_gelezen: vandaag })).status, 201)
  })
})

// ---------- Dubbelen ----------

test('dubbel ISBN wordt geweigerd (ook in een andere schrijfwijze, ook met "forceer") en niets verandert', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const isbn of [BOEK_A.isbn, '978-0-261-10221-7', 'ISBN 9780261102217']) {
      const { status, data } = await post(server, { titel: 'Heel ander boek', isbn, forceer: true })
      assert.equal(status, 409, isbn)
      assert.equal(data.soort, 'isbn-dubbel')
      assert.equal(data.kanForceren, false)
      assert.equal(data.bestaand.id, BOEK_A.id)
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('gelijke titel (ook zonder hoofdletters of met toevoeging tussen haakjes) geeft een waarschuwing; met "forceer" kan het toch', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const titel of ['the hobbit', 'The Hobbit (Illustrated edition)']) {
      const { status, data } = await post(server, { titel })
      assert.equal(status, 409, titel)
      assert.equal(data.soort, 'titel-dubbel')
      assert.equal(data.kanForceren, true)
      assert.equal(data.bestaand.id, BOEK_A.id)
    }
    assertOnveranderd(voor, momentopname(root))
    const toch = await post(server, { titel: 'the hobbit', forceer: true })
    assert.equal(toch.status, 201)
    assert.equal(momentopname(root).gelezen.length, voor.gelezen.length + 1)
  })
})

test('dezelfde titel van een andere auteur is geen dubbel', async () => {
  await metProject(async ({ server }) => {
    assert.equal((await post(server, { titel: 'The Hobbit', auteur: 'Iemand Anders' })).status, 201)
  })
})

// ---------- Goodreads-link ----------

test('Goodreads-link: verschillende schrijfwijzen worden herkend en als goodreads_id opgeslagen', async () => {
  await metProject(async ({ root, server }) => {
    const gevallen = [
      ['https://www.goodreads.com/book/show/1111.Een_Titel', '1111'],
      ['https://www.goodreads.com/nl/book/show/2222-nog-een-titel?ref=nav_sb_ss_1_4', '2222'],
      ['goodreads.com/book/show/3333', '3333'],
      ['  4444  ', '4444'], // alleen het nummer mag ook
    ]
    for (const [i, [invoer, verwacht]] of gevallen.entries()) {
      const { status, data } = await post(server, { titel: `Met link ${i}`, goodreads: invoer })
      assert.equal(status, 201, invoer)
      assert.equal(data.boek.goodreads_id, verwacht, invoer)
    }
    const g = momentopname(root).gelezen
    // zelfde veldvolgorde als bij de import: id, isbn, goodreads_id, titel, ...
    assert.deepEqual(Object.keys(g.find((b) => b.titel === 'Met link 0')), ['id', 'goodreads_id', 'titel', 'auteur', 'datum_gelezen'])
    const zonder = await post(server, { titel: 'Zonder link' })
    assert.ok(!('goodreads_id' in zonder.data.boek), 'zonder link hoort er geen goodreads_id te komen')
  })
})

test('geen geldige Goodreads-link: geweigerd, niets verandert', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const link of ['https://example.com/book/show/123', 'https://www.goodreads.com/work/editions/123', 'https://www.goodreads.com/book/show/', 'abc', '1234567890123']) {
      const { status, data } = await post(server, { titel: 'T', goodreads: link })
      assert.equal(status, 400, link)
      assert.equal(data.veld, 'goodreads', link)
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('een Goodreads-link die al bij een ander boek hoort wordt geweigerd (ook met "forceer")', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const goodreads of ['https://www.goodreads.com/book/show/5907.The_Hobbit', '5907']) {
      const { status, data } = await post(server, { titel: 'Heel ander boek', goodreads, forceer: true })
      assert.equal(status, 409)
      assert.equal(data.soort, 'goodreads-dubbel')
      assert.equal(data.kanForceren, false)
      assert.equal(data.bestaand.id, BOEK_A.id)
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

// ---------- Covers ----------

test('een bestand dat geen afbeelding is wordt geweigerd: geen boek, geen coverbestand', nodigSharp, async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const nep = dataUrl(Buffer.from('dit is gewoon tekst, geen plaatje'), 'image/png')
    const { status, data } = await post(server, { titel: 'Met nepcover', isbn: ISBN_NIEUW, cover: nep })
    assert.equal(status, 400)
    assert.equal(data.veld, 'cover')
    assertOnveranderd(voor, momentopname(root))
    assert.equal((await post(server, { titel: 'Nog een nepcover', cover: 'geen-data-url' })).status, 400)
  })
})

test('een bestaand coverbestand wordt nooit overschreven', nodigSharp, async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const png = await maakPng(300, 450)
    // Er staat al een cover voor dit ISBN (maar nog geen boek): upload wordt geweigerd, bestand blijft intact.
    const geweigerd = await post(server, { titel: 'Boek bij weescover', isbn: ISBN_WEES, cover: dataUrl(png) })
    assert.equal(geweigerd.status, 409)
    assert.equal(geweigerd.data.soort, 'cover-bestaat')
    assertOnveranderd(voor, momentopname(root))
    // Zonder upload kan het boek wel worden toegevoegd en wordt de bestaande cover gewoon gebruikt.
    const zonder = await post(server, { titel: 'Boek bij weescover', isbn: ISBN_WEES })
    assert.equal(zonder.status, 201)
    assert.deepEqual(zonder.data.covers, { voor: true })
    assert.equal(fs.readFileSync(path.join(root, `public/covers/${ISBN_WEES}-voor.jpg`), 'utf8'), WEES_COVER)
  })
})

// ---------- Betrouwbaarheid ----------

test('mislukt opslaan wordt teruggedraaid (cover verwijderd, bestanden zoals ervoor) en een nieuwe poging werkt', nodigSharp, async () => {
  const root = maakProject()
  const falend = (bestand, data) => {
    if (bestand.endsWith('beoordelingen.json')) throw new Error('schijf vol (gesimuleerd)')
    return schrijfJsonAtomisch(bestand, data)
  }
  const kapot = await startServer(root, { schrijfJson: falend })
  const goed = await startServer(root)
  try {
    const voor = momentopname(root)
    const invoer = { titel: 'Zou mislukken', isbn: ISBN_NIEUW, score: 5, cover: dataUrl(await maakPng(600, 900)) }
    const mislukt = await post(kapot, invoer)
    assert.equal(mislukt.status, 500)
    assert.match(mislukt.data.fout, /niets gewijzigd/)
    assertOnveranderd(voor, momentopname(root)) // gelezen.json terug, cover weg
    assert.ok(!fs.existsSync(path.join(root, `public/covers/${ISBN_NIEUW}-voor.jpg`)))
    assert.deepEqual(fs.readdirSync(path.join(root, 'src/data')).sort(), ['beoordelingen.json', 'covers.json', 'gelezen.json'], 'geen tijdelijke bestanden achtergebleven')

    const opnieuw = await post(goed, invoer) // het weggegooide cover-id blokkeert de nieuwe poging niet
    assert.equal(opnieuw.status, 201)
  } finally {
    await kapot.stop()
    await goed.stop()
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('een kapotte gelezen.json wordt nooit overschreven', async () => {
  await metProject(async ({ root, server }) => {
    const kapotteTekst = '[ {"id": "9780261102217", "titel": '
    fs.writeFileSync(path.join(root, 'src/data/gelezen.json'), kapotteTekst)
    const { status, data } = await post(server, { titel: 'Zou alles vervangen' })
    assert.equal(status, 500)
    assert.match(data.fout, /geen geldige JSON/)
    assert.equal(fs.readFileSync(path.join(root, 'src/data/gelezen.json'), 'utf8'), kapotteTekst)
  })
})

test('gelijktijdige aanvragen: twee verschillende boeken gaan er allebei in, hetzelfde ISBN maar één keer', nodigSharp, async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const png = dataUrl(await maakPng(400, 600))
    const [een, twee] = await Promise.all([post(server, { titel: 'Gelijktijdig een', cover: png }), post(server, { titel: 'Gelijktijdig twee', cover: png })])
    assert.deepEqual([een.status, twee.status], [201, 201])
    assert.equal(momentopname(root).gelezen.length, voor.gelezen.length + 2, 'er is een wijziging verloren gegaan')

    const dubbel = await Promise.all([post(server, { titel: 'Zelfde A', isbn: ISBN_NIEUW }), post(server, { titel: 'Zelfde B', isbn: ISBN_NIEUW })])
    assert.deepEqual(dubbel.map((d) => d.status).sort(), [201, 409])
    assert.equal(momentopname(root).gelezen.filter((b) => b.id === ISBN_NIEUW).length, 1)
  })
})

test('na een herstart van de server staat het boek er nog en wordt het niet opnieuw toegevoegd', async () => {
  const root = maakProject()
  const servers = []
  try {
    const eerste = await startServer(root)
    servers.push(eerste)
    const opgeslagen = await post(eerste, { titel: 'Blijft bewaard', isbn: ISBN_NIEUW, score: 5 })
    assert.equal(opgeslagen.status, 201)
    await eerste.stop()

    const tweede = await startServer(root) // nieuwe handler, geen geheugen van eerder
    servers.push(tweede)
    const opnieuw = await post(tweede, { titel: 'Blijft bewaard', isbn: ISBN_NIEUW })
    assert.equal(opnieuw.status, 409)
    assert.equal(opnieuw.data.bestaand.titel, 'Blijft bewaard')
    assert.equal(momentopname(root).gelezen.filter((b) => b.id === ISBN_NIEUW).length, 1)
  } finally {
    await Promise.all(servers.map((s) => s.stop())) // ook als een assertie faalt, anders blijft de test hangen
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('alles wat de API wegschrijft komt door de echte validatie (scripts/validate-data.js)', async () => {
  await metProject(async ({ root, server }) => {
    const heeftCover = sharp ? dataUrl(await maakPng(800, 1200)) : null
    await post(server, { titel: 'Alleen titel' })
    await post(server, { titel: 'Met alles', auteur: 'Auteur', isbn: ISBN_NIEUW_10, goodreads: 'https://www.goodreads.com/book/show/88888.Test', datum_gelezen: '2026-03-03', score: 2, notitie: 'Tja.', cover: heeftCover })
    await post(server, { titel: 'Zonder auteur met datum', datum_gelezen: '2020-01-01' })
    const uitkomst = spawnSync(process.execPath, ['scripts/validate-data.js'], { cwd: root, encoding: 'utf8' })
    assert.equal(uitkomst.status, 0, uitkomst.stdout + uitkomst.stderr)
    assert.match(uitkomst.stdout, /Data klopt \(6 boeken, 2 beoordelingen/)
  })
})

// ======================================================================
// Bewerken: PATCH /api/boeken/<id>
// ======================================================================

const metTitel = (boek, titel) => ({ ...boek, titel })

test('bewerken: alleen de titel wijzigen — id en alle andere velden blijven, de rest van het bestand is identiek', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const { status, data } = await patch(server, BOEK_A.id, { titel: 'The Hobbit (herziene uitgave)' }, { titel: 'The Hobbit' })
    assert.equal(status, 200)
    assert.equal(data.ongewijzigd, false)
    assert.deepEqual(data.gewijzigd, ['titel'])
    assert.equal(data.boek.id, BOEK_A.id)

    const na = momentopname(root)
    assert.equal(na.gelezenTekst, json([metTitel(BOEK_A, 'The Hobbit (herziene uitgave)'), BOEK_B, BOEK_C]), 'alleen de titel van A mag anders zijn')
    assert.equal(na.gelezen.length, voor.gelezen.length, 'bewerken mag nooit een nieuw boek maken')
    assert.equal(na.beoordelingenTekst, voor.beoordelingenTekst, 'beoordelingen.json blijft onaangeroerd')
    assert.deepEqual(na.covers, voor.covers)
  })
})

test('bewerken: meerdere velden tegelijk (ISBN bij een boek zonder ISBN, Goodreads-link, datum, pagina\'s, jaar) en daarna weer leegmaken', async () => {
  await metProject(async ({ root, server }) => {
    const eerste = await patch(
      server, BOEK_B.id,
      { auteur: 'Nieuwe Auteur', isbn: '0-306-40615-2', goodreads: 'https://www.goodreads.com/book/show/2468.Iets', datum_gelezen: '2026-02-02', paginas: '320', jaar_origineel: '-800' },
      { auteur: 'Ergens Iemand', isbn: null, goodreads: '777', datum_gelezen: '2024-05-01', paginas: null, jaar_origineel: null },
    )
    assert.equal(eerste.status, 200)
    const b1 = { id: 'gr-777', isbn: ISBN_NIEUW, goodreads_id: '2468', titel: 'Boek zonder ISBN', auteur: 'Nieuwe Auteur', datum_gelezen: '2026-02-02', paginas: 320, jaar_origineel: -800 }
    // id blijft gr-777; nieuwste datum dus bovenaan; de andere boeken houden hun volgorde (A, C)
    assert.equal(momentopname(root).gelezenTekst, json([b1, BOEK_A, BOEK_C]))

    const tweede = await patch(
      server, BOEK_B.id,
      { isbn: '', goodreads: '', paginas: '', jaar_origineel: '', datum_gelezen: '' },
      { isbn: ISBN_NIEUW, goodreads: '2468', paginas: 320, jaar_origineel: -800, datum_gelezen: '2026-02-02' },
    )
    assert.equal(tweede.status, 200)
    const b2 = { id: 'gr-777', titel: 'Boek zonder ISBN', auteur: 'Nieuwe Auteur', datum_gelezen: null } // datum blijft als sleutel (null = onbekend)
    assert.equal(momentopname(root).gelezenTekst, json([BOEK_A, b2, BOEK_C]), 'zonder datum hoort het boek bij de andere boeken zonder datum')
  })
})

test('bewerken: het ISBN van een boek waarvan het ISBN het id is kan niet veranderen (dezelfde waarde sturen mag wel)', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const geweigerd = await patch(server, BOEK_A.id, { isbn: ISBN_NIEUW_10 }, { isbn: BOEK_A.isbn })
    assert.equal(geweigerd.status, 400)
    assert.equal(geweigerd.data.veld, 'isbn')
    assertOnveranderd(voor, momentopname(root))
    const gelijkAanHuidig = await patch(server, BOEK_A.id, { isbn: '978-0-261-10221-7' }, { isbn: BOEK_A.isbn })
    assert.equal(gelijkAanHuidig.status, 200)
    assert.equal(gelijkAanHuidig.data.ongewijzigd, true)
    assertOnveranderd(voor, momentopname(root))
  })
})

test('bewerken: niets veranderd = niets geschreven', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const { status, data } = await patch(server, BOEK_A.id, { titel: '  The   Hobbit ', paginas: '310', notitie: 'Prachtig.' }, { titel: 'The Hobbit', paginas: 310, notitie: 'Prachtig.' })
    assert.equal(status, 200)
    assert.equal(data.ongewijzigd, true)
    assert.deepEqual(data.gewijzigd, [])
    assertOnveranderd(voor, momentopname(root))
  })
})

test('bewerken: beoordeling wijzigen raakt alleen beoordelingen.json aan, en een opmerking leegmaken verwijdert hem', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const { status, data } = await patch(server, BOEK_A.id, { score: 3, favoriet: false, notitie: '' }, { score: 5, favoriet: true, notitie: 'Prachtig.' })
    assert.equal(status, 200)
    assert.deepEqual(data.beoordeling, { id: BOEK_A.id, score: 3, favoriet: false })
    const na = momentopname(root)
    assert.equal(na.beoordelingenTekst, json([{ id: BOEK_A.id, score: 3, favoriet: false }]))
    assert.equal(na.gelezenTekst, voor.gelezenTekst, 'gelezen.json blijft onaangeroerd')
    const alleenNotitie = await patch(server, BOEK_A.id, { notitie: 'Nieuw' }, { notitie: null })
    assert.deepEqual(alleenNotitie.data.beoordeling, { id: BOEK_A.id, score: 3, favoriet: false, notitie: 'Nieuw' })
  })
})

test('bewerken: een beoordeling aanmaken voor een onbeoordeeld boek (en favoriet/opmerking zonder score mag niet)', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const [wijz, orig] of [[{ favoriet: true }, { favoriet: false }], [{ notitie: 'zomaar' }, { notitie: null }]]) {
      const { status, data } = await patch(server, BOEK_B.id, wijz, orig)
      assert.equal(status, 400)
      assert.equal(data.veld, 'score')
    }
    assertOnveranderd(voor, momentopname(root))
    const { status, data } = await patch(server, BOEK_B.id, { score: 4, favoriet: true, notitie: 'Goed' }, { score: null, favoriet: false, notitie: null })
    assert.equal(status, 200)
    assert.equal(momentopname(root).beoordelingenTekst, json([BEOORDELING_A, { id: BOEK_B.id, score: 4, favoriet: true, notitie: 'Goed' }]))
    assert.equal(data.beoordeling.score, 4)
  })
})

test('bewerken: de score weghalen mag alleen als er geen favoriet-markering of opmerking aan hangt', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const geweigerd = await patch(server, BOEK_A.id, { score: null }, { score: 5 })
    assert.equal(geweigerd.status, 400)
    assert.equal(geweigerd.data.veld, 'score')
    assertOnveranderd(voor, momentopname(root))
    const alles = await patch(server, BOEK_A.id, { score: null, favoriet: false, notitie: '' }, { score: 5, favoriet: true, notitie: 'Prachtig.' })
    assert.equal(alles.status, 200)
    assert.equal(alles.data.beoordeling, null)
    assert.equal(momentopname(root).beoordelingenTekst, '[]\n')
  })
})

test('bewerken: ongeldige invoer wordt geweigerd en laat alles ongemoeid', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const orig = { titel: 'The Hobbit', datum_gelezen: '2025-11-02', isbn: BOEK_A.isbn, paginas: 310, jaar_origineel: 1937, score: 5, favoriet: true, goodreads: '5907' }
    const gevallen = [
      [{ titel: '   ' }, 'titel'],
      [{ titel: 'x'.repeat(301) }, 'titel'],
      [{ datum_gelezen: '2999-01-01' }, 'datum_gelezen'],
      [{ datum_gelezen: '2025-02-30' }, 'datum_gelezen'],
      [{ isbn: '12345' }, 'isbn'],
      [{ paginas: '0' }, 'paginas'],
      [{ paginas: 'abc' }, 'paginas'],
      [{ paginas: 1.5 }, 'paginas'],
      [{ jaar_origineel: 3000 }, 'jaar_origineel'],
      [{ score: 6 }, 'score'],
      [{ favoriet: 'ja' }, 'favoriet'],
      [{ goodreads: 'https://example.com/x' }, 'goodreads'],
    ]
    for (const [wijz, veld] of gevallen) {
      const sleutel = Object.keys(wijz)[0]
      const { status, data } = await patch(server, BOEK_A.id, wijz, { [sleutel]: orig[sleutel] })
      assert.equal(status, 400, JSON.stringify(wijz))
      assert.equal(data.veld, veld, JSON.stringify(wijz))
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('bewerken: een onbekend veld (ook het id!), ontbrekende origineel-waarde of lege wijzigingen wordt geweigerd', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const body of [
      { wijzigingen: { id: 'gr-1' }, origineel: { id: BOEK_A.id } },
      { wijzigingen: { cover_url: 'https://example.com/c.jpg' }, origineel: { cover_url: null } },
      { wijzigingen: { titel: 'Nieuw' }, origineel: {} },
      { wijzigingen: {}, origineel: {} },
      { wijzigingen: 'titel', origineel: {} },
      'geen object',
    ]) {
      const antwoord = await fetch(`${server.url}boeken/${BOEK_A.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      assert.equal(antwoord.status, 400, JSON.stringify(body))
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('bewerken: een ISBN of Goodreads-link van een ánder boek wordt geweigerd; de eigen Goodreads-link opnieuw sturen mag', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const isbn = await patch(server, BOEK_B.id, { isbn: BOEK_A.isbn }, { isbn: null })
    assert.equal(isbn.status, 409)
    assert.equal(isbn.data.soort, 'isbn-dubbel')
    assert.equal(isbn.data.bestaand.id, BOEK_A.id)
    const goodreads = await patch(server, BOEK_B.id, { goodreads: 'https://www.goodreads.com/book/show/5907.The_Hobbit' }, { goodreads: '777' })
    assert.equal(goodreads.status, 409)
    assert.equal(goodreads.data.soort, 'goodreads-dubbel')
    assertOnveranderd(voor, momentopname(root))
    const eigen = await patch(server, BOEK_B.id, { goodreads: 'https://www.goodreads.com/book/show/777.Eigen' }, { goodreads: '777' })
    assert.equal(eigen.status, 200)
    assert.equal(eigen.data.ongewijzigd, true)
  })
})

test('bewerken: is het boek intussen elders gewijzigd, dan wordt er niets overschreven; andere velden die elders wijzigden blijven behouden', async () => {
  await metProject(async ({ root, server }) => {
    // Iemand (of een script) past intussen buiten de website de titel van B aan
    const bestand = path.join(root, 'src/data/gelezen.json')
    const lijst = JSON.parse(fs.readFileSync(bestand, 'utf8'))
    lijst.find((b) => b.id === BOEK_B.id).titel = 'Elders aangepast'
    fs.writeFileSync(bestand, json(lijst))
    const voor = momentopname(root)

    const conflict = await patch(server, BOEK_B.id, { titel: 'Mijn wijziging' }, { titel: 'Boek zonder ISBN' }) // verouderde waarde
    assert.equal(conflict.status, 409)
    assert.equal(conflict.data.soort, 'conflict')
    assert.deepEqual(conflict.data.velden, ['titel'])
    assertOnveranderd(voor, momentopname(root))

    // Een ander veld wijzigen mag wel: de elders aangepaste titel blijft staan
    const ander = await patch(server, BOEK_B.id, { auteur: 'Nieuwe Auteur' }, { auteur: 'Ergens Iemand' })
    assert.equal(ander.status, 200)
    const b = momentopname(root).gelezen.find((x) => x.id === BOEK_B.id)
    assert.equal(b.titel, 'Elders aangepast')
    assert.equal(b.auteur, 'Nieuwe Auteur')
  })
})

test('bewerken: velden die de website niet kent (bijvoorbeeld cover_url, genre) blijven behouden', async () => {
  await metProject(async ({ root, server }) => {
    const bestand = path.join(root, 'src/data/gelezen.json')
    const lijst = JSON.parse(fs.readFileSync(bestand, 'utf8'))
    Object.assign(lijst.find((b) => b.id === BOEK_A.id), { cover_url: 'https://example.com/c.jpg', genre: 'Fantasy' })
    fs.writeFileSync(bestand, json(lijst))
    await patch(server, BOEK_A.id, { auteur: 'Tolkien' }, { auteur: 'J.R.R. Tolkien' })
    const a = momentopname(root).gelezen.find((b) => b.id === BOEK_A.id)
    assert.deepEqual(Object.keys(a), ['id', 'isbn', 'goodreads_id', 'titel', 'auteur', 'datum_gelezen', 'paginas', 'jaar_origineel', 'cover_url', 'genre'])
    assert.equal(a.cover_url, 'https://example.com/c.jpg')
    assert.equal(a.genre, 'Fantasy')
  })
})

test('bewerken: een onbekend of onzinnig id geeft 404 en maakt nooit een nieuw boek', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    for (const id of ['gr-99999', 'eigen-5', '9780306406157', '../../etc/passwd', 'abc']) {
      const { status } = await patch(server, id, { titel: 'Nieuw' }, { titel: null })
      assert.equal(status, 404, id)
    }
    assertOnveranderd(voor, momentopname(root))
  })
})

test('bewerken: mislukt schrijven wordt teruggedraaid (gelezen.json weer zoals ervoor)', async () => {
  const falend = (bestand, data) => {
    if (bestand.endsWith('beoordelingen.json')) throw new Error('schijf vol (gesimuleerd)')
    return schrijfJsonAtomisch(bestand, data)
  }
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const { status, data } = await patch(server, BOEK_A.id, { titel: 'Zou mislukken', score: 2 }, { titel: 'The Hobbit', score: 5 })
    assert.equal(status, 500)
    assert.match(data.fout, /vorige gegevens en cover zijn hersteld/)
    assertOnveranderd(voor, momentopname(root))
    assert.deepEqual(fs.readdirSync(path.join(root, 'src/data')).sort(), ['beoordelingen.json', 'covers.json', 'gelezen.json'], 'geen tijdelijke bestanden achtergebleven')
  }, { schrijfJson: falend })
})

test('bewerken: aanvragen van een andere website, of zonder JSON-type, worden geweigerd', async () => {
  await metProject(async ({ root, server }) => {
    const voor = momentopname(root)
    const body = JSON.stringify({ wijzigingen: { titel: 'Kwaadwillend' }, origineel: { titel: 'The Hobbit' } })
    const pad = `boeken/${BOEK_A.id}`
    assert.equal((await ruw(server, { method: 'PATCH', pad, headers: { 'Content-Type': 'application/json', Origin: 'http://evil.example' }, body })).status, 403)
    assert.equal((await ruw(server, { method: 'PATCH', pad, headers: { 'Content-Type': 'text/plain' }, body })).status, 415)
    assert.equal((await ruw(server, { method: 'PATCH', pad, headers: { Host: 'evil.example', 'Content-Type': 'application/json' }, body })).status, 403)
    assertOnveranderd(voor, momentopname(root))
  })
})

test('bewerken: gelijktijdige bewerkingen van verschillende boeken gaan er allebei in', async () => {
  await metProject(async ({ root, server }) => {
    const [een, twee] = await Promise.all([
      patch(server, BOEK_A.id, { auteur: 'Auteur A' }, { auteur: 'J.R.R. Tolkien' }),
      patch(server, BOEK_B.id, { auteur: 'Auteur B' }, { auteur: 'Ergens Iemand' }),
    ])
    assert.deepEqual([een.status, twee.status], [200, 200])
    const g = momentopname(root).gelezen
    assert.equal(g.find((b) => b.id === BOEK_A.id).auteur, 'Auteur A')
    assert.equal(g.find((b) => b.id === BOEK_B.id).auteur, 'Auteur B')
  })
})

test('bewerken: na een herstart van de server is de wijziging er nog, en de echte validatie keurt alles goed', async () => {
  const root = maakProject()
  const servers = []
  try {
    const eerste = await startServer(root)
    servers.push(eerste)
    assert.equal((await patch(eerste, BOEK_A.id, { titel: 'Blijvend gewijzigd', score: 2 }, { titel: 'The Hobbit', score: 5 })).status, 200)
    assert.equal((await patch(eerste, BOEK_B.id, { goodreads: '1357', datum_gelezen: '2026-01-01' }, { goodreads: '777', datum_gelezen: '2024-05-01' })).status, 200)
    await eerste.stop()

    const tweede = await startServer(root) // nieuwe handler, geen geheugen van eerder
    servers.push(tweede)
    const verouderd = await patch(tweede, BOEK_A.id, { titel: 'Nog eens' }, { titel: 'The Hobbit' })
    assert.equal(verouderd.status, 409, 'de oude titel bestaat niet meer: de wijziging is dus echt bewaard')
    assert.equal((await patch(tweede, BOEK_A.id, { titel: 'Nog eens' }, { titel: 'Blijvend gewijzigd' })).status, 200)

    const uitkomst = spawnSync(process.execPath, ['scripts/validate-data.js'], { cwd: root, encoding: 'utf8' })
    assert.equal(uitkomst.status, 0, uitkomst.stdout + uitkomst.stderr)
    assert.match(uitkomst.stdout, /Data klopt \(3 boeken/)
  } finally {
    await Promise.all(servers.map((s) => s.stop()))
    fs.rmSync(root, { recursive: true, force: true })
  }
})
