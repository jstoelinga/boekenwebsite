import fs from 'fs'
import path from 'path'

const DATA_FILE = './src/data/gelezen.json'
const COVERS_DIR = './public/covers'
const STATUS_FILE = './covers-download-status.json'
const LIMIET = 50

const boeken = JSON.parse(
  fs.readFileSync(DATA_FILE, 'utf8')
)

fs.mkdirSync(COVERS_DIR, {
  recursive: true
})

// Eerdere downloadpogingen laden
let status = {
  geprobeerd: []
}

if (fs.existsSync(STATUS_FILE)) {
  status = JSON.parse(
    fs.readFileSync(STATUS_FILE, 'utf8')
  )
}

const geprobeerd = new Set(
  status.geprobeerd || []
)

// Alleen boeken die:
// 1. een ISBN hebben
// 2. nog geen lokale cover hebben
// 3. nog niet eerder geprobeerd zijn
const boekenTeProberen = boeken
  .filter((boek) => boek.isbn)
  .filter((boek) => {
    const cover = path.join(
      COVERS_DIR,
      `${boek.id}-voor.jpg`
    )

    return !fs.existsSync(cover)
  })
  .filter((boek) => {
    return !geprobeerd.has(String(boek.isbn))
  })
  .slice(0, LIMIET)

console.log(
  `\n${boekenTeProberen.length} nieuwe boeken om te proberen.\n`
)

let gedownload = 0
let nietGevonden = 0

for (const boek of boekenTeProberen) {
  const isbn = String(boek.isbn)

  const doel = path.join(
    COVERS_DIR,
    `${boek.id}-voor.jpg`
  )

  console.log(`📖 ${boek.titel}`)
  console.log(`   ISBN: ${isbn}`)

  // Deze ISBN is vanaf nu geprobeerd,
  // ook als Open Library niets vindt.
  geprobeerd.add(isbn)

  const url =
    `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`

  try {
    const response = await fetch(url)

    if (!response.ok) {
      console.log('   ✗ Cover niet gevonden.\n')
      nietGevonden++
      continue
    }

    const buffer = Buffer.from(
      await response.arrayBuffer()
    )

    if (buffer.length < 1000) {
      console.log(
        '   ✗ Geen bruikbare afbeelding ontvangen.\n'
      )
      nietGevonden++
      continue
    }

    fs.writeFileSync(doel, buffer)

    console.log(
      `   ✓ Cover opgeslagen: ${boek.id}-voor.jpg\n`
    )

    gedownload++
  } catch (error) {
    console.log(
      `   ✗ Fout bij downloaden: ${error.message}\n`
    )

    nietGevonden++
  }
}

// Status opslaan
fs.writeFileSync(
  STATUS_FILE,
  JSON.stringify(
    {
      geprobeerd: [...geprobeerd]
    },
    null,
    2
  )
)

console.log('----------------------------------------')
console.log(`✓ Nieuwe covers: ${gedownload}`)
console.log(`✗ Niet gevonden: ${nietGevonden}`)
console.log(
  `✓ Totaal geprobeerd: ${geprobeerd.size}`
)
console.log('----------------------------------------\n')