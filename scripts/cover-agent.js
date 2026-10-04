import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { execFileSync } from 'child_process'

const DATA_FILE = './src/data/gelezen.json'
const INBOX_DIR = './covers-inbox'
const COVERS_DIR = './public/covers'
const BACKUP_DIR = './public/covers/backup'

const STOPWOORDEN = new Set([
  'de',
  'het',
  'een',
  'en',
  'in',
  'van',
  'voor',
  'op',
  'aan',
  'met',
  'bij',
  'te',
  'der',
  'den',
  'een',
  'boek',
  'cover',
  'exemplaar',
  'voorzijde',
  'achterzijde'
])

function normalize(text, isFilename = false) {
  let waarde = text

  if (isFilename) {
    waarde = waarde.replace(/\.[^/.]+$/, '')
  }

  return waarde
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function zoekwoordenUitBestandsnaam(bestand) {
  return normalize(bestand, true)
    .split(/\s+/)
    .filter((woord) => woord.length >= 3)
    .filter((woord) => !STOPWOORDEN.has(woord))
}

function vraag(tekst) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })

  return new Promise((resolve) => {
    rl.question(tekst, (antwoord) => {
      rl.close()
      resolve(antwoord.trim().toLowerCase())
    })
  })
}

function lokaleCover(boek) {
  return fs.existsSync(
    path.join(COVERS_DIR, `${boek.id}-voor.jpg`)
  )
}

function plaatsNieuweCover(boek, bron) {
  const doel = path.join(
    COVERS_DIR,
    `${boek.id}-voor.jpg`
  )

  fs.renameSync(bron, doel)

  console.log(
    `   ✓ Nieuwe cover geplaatst: ${boek.id}-voor.jpg`
  )
}

function backupEnVervang(boek, bron) {
  const doel = path.join(
    COVERS_DIR,
    `${boek.id}-voor.jpg`
  )

  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const datum = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)

  const backupNaam =
    `${boek.id}-voor-${datum}.jpg`

  const backupPad =
    path.join(BACKUP_DIR, backupNaam)

  fs.copyFileSync(doel, backupPad)

  console.log(
    `   ✓ Oude cover geback-upt: ${backupNaam}`
  )

  fs.renameSync(bron, doel)

  console.log(
    `   ✓ Nieuwe cover geplaatst: ${boek.id}-voor.jpg`
  )
}

function vindMatches(boeken, bestand) {
  const zoekwoorden =
    zoekwoordenUitBestandsnaam(bestand)

  if (zoekwoorden.length === 0) {
    return []
  }

  const kandidaten = []

  for (const boek of boeken) {
    const titel = normalize(boek.titel || '')

    // ALLE zoekwoorden moeten in de titel voorkomen.
    const alleWoordenGevonden =
      zoekwoorden.every((woord) =>
        titel.includes(woord)
      )

    if (!alleWoordenGevonden) {
      continue
    }

    let score = 0

    // Hoe meer van de oorspronkelijke tekst overeenkomt,
    // hoe hoger de score.
    for (const woord of zoekwoorden) {
      if (titel.includes(woord)) {
        score += woord.length
      }
    }

    // Bonus wanneer de volledige zoekterm in de titel voorkomt.
    const volledigeZoekterm =
      normalize(bestand, true)

    if (titel.includes(volledigeZoekterm)) {
      score += 1000
    }

    // Bonus wanneer de titel exact gelijk is.
    if (titel === volledigeZoekterm) {
      score += 5000
    }

    kandidaten.push({
      boek,
      score
    })
  }

  kandidaten.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score
    }

    return (a.boek.titel || '').localeCompare(
      b.boek.titel || '',
      'nl'
    )
  })

  return kandidaten.map((item) => item.boek)
}

const boeken =
  JSON.parse(
    fs.readFileSync(DATA_FILE, 'utf8')
  )

if (!fs.existsSync(INBOX_DIR)) {
  console.log(
    '❌ covers-inbox bestaat niet.'
  )
  process.exit(1)
}

fs.mkdirSync(COVERS_DIR, {
  recursive: true
})

fs.mkdirSync(BACKUP_DIR, {
  recursive: true
})

const bestanden =
  fs.readdirSync(INBOX_DIR)
    .filter((bestand) =>
      /\.(jpg|jpeg)$/i.test(bestand)
    )

console.log(
  `\n${bestanden.length} coverbestand(en) gevonden in covers-inbox\n`
)

let toegevoegd = 0
let vervangen = 0
let overgeslagen = 0

for (const bestand of bestanden) {
  const bron =
    path.join(INBOX_DIR, bestand)

  const zoekwoorden =
    zoekwoordenUitBestandsnaam(bestand)

  console.log(`📖 ${bestand}`)

  console.log(
    `   🔎 Zoekwoorden: ${zoekwoorden.join(', ')}`
  )

  const matches =
    vindMatches(boeken, bestand)

  if (matches.length === 0) {
    console.log(
      '   ❌ Geen match gevonden'
    )

    console.log(
      '   → Bestand blijft in covers-inbox\n'
    )

    overgeslagen++
    continue
  }

  let verwerkt = false

  // -----------------------------------------
  // EXACT / ENKELE MATCH
  // -----------------------------------------

  if (matches.length === 1) {
    const boek = matches[0]

    console.log(
      `   ✓ Match: ${boek.titel}`
    )

    console.log(
      `   ✓ ID: ${boek.id}`
    )

    if (!lokaleCover(boek)) {
      plaatsNieuweCover(
        boek,
        bron
      )

      toegevoegd++
      verwerkt = true
    } else {
      console.log(
        '   ⚠ Er bestaat al een lokale cover.'
      )

      const antwoord =
        await vraag(
          '   Bestaande cover vervangen? [j/n]: '
        )

      if (
        antwoord === 'j' ||
        antwoord === 'ja'
      ) {
        backupEnVervang(
          boek,
          bron
        )

        vervangen++
        verwerkt = true
      } else {
        console.log(
          '   → Bestaande cover behouden.'
        )
      }
    }
  }

  // -----------------------------------------
  // MEERDERE MATCHES
  // -----------------------------------------

  if (matches.length > 1) {
    console.log(
      `   ⚠ ${matches.length} mogelijke matches gevonden.`
    )

    for (const boek of matches) {
      console.log('')
      console.log(
        `   📖 ${boek.titel}`
      )

      console.log(
        `   🆔 ${boek.id}`
      )

      if (lokaleCover(boek)) {
        const antwoord =
          await vraag(
            '   Deze bestaande cover vervangen? [j/n]: '
          )

        if (
          antwoord === 'j' ||
          antwoord === 'ja'
        ) {
          backupEnVervang(
            boek,
            bron
          )

          vervangen++
          verwerkt = true
          break
        }

        console.log(
          '   → Nee, ik probeer het volgende boek.'
        )
      } else {
        const antwoord =
          await vraag(
            '   Bedoel je dit boek? [j/n]: '
          )

        if (
          antwoord === 'j' ||
          antwoord === 'ja'
        ) {
          plaatsNieuweCover(
            boek,
            bron
          )

          toegevoegd++
          verwerkt = true
          break
        }

        console.log(
          '   → Nee, ik probeer het volgende boek.'
        )
      }
    }
  }

  if (!verwerkt) {
    console.log(
      '   → Bestand blijft in covers-inbox.'
    )

    overgeslagen++
  }

  console.log('')
}

console.log(
  '----------------------------------------'
)

console.log(
  `✓ Nieuwe covers: ${toegevoegd}`
)

console.log(
  `🔄 Vervangen: ${vervangen}`
)

console.log(
  `⚠ Overgeslagen: ${overgeslagen}`
)

console.log(
  '----------------------------------------\n'
)

if (
  toegevoegd > 0 ||
  vervangen > 0
) {
  console.log(
    '🔎 Covers opnieuw scannen...\n'
  )

  try {
    execFileSync(
      'node',
      ['scripts/scan-covers.js'],
      {
        stdio: 'inherit'
      }
    )
  } catch (error) {
    console.log(
      '\n❌ Het scannen van covers is mislukt.'
    )

    process.exit(1)
  }
}

console.log('\nKlaar.')