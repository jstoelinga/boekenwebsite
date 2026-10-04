// Zoekt een boek in gelezen.json en toont het id, zodat je weet hoe je de coverbestanden moet noemen.
//
//   npm run zoek -- hobbit
//   npm run zoek -- tolkien hobbit      (alle woorden moeten voorkomen in titel of auteur)

import fs from 'node:fs'
import { PATHS, readJson } from './lib/common.js'

const woorden = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!woorden.length) {
  console.log('Gebruik: npm run zoek -- <deel van titel of auteur>')
  process.exit(1)
}

const normaliseer = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const gelezen = readJson(PATHS.gelezen, [])
const gezocht = woorden.map(normaliseer)

const treffers = gelezen.filter((b) => {
  const tekst = normaliseer(`${b.titel} ${b.auteur}`)
  return gezocht.every((w) => tekst.includes(w))
})

if (!treffers.length) {
  console.log('Geen boeken gevonden.')
  process.exit(0)
}

const MAX = 15
for (const b of treffers.slice(0, MAX)) {
  const heeft = ['voor', 'achter'].filter((k) => fs.existsSync(`${PATHS.coversDir}/${b.id}-${k}.jpg`))
  console.log(`${b.id}   ${b.titel} — ${b.auteur}${heeft.length ? `   [cover: ${heeft.join(', ')}]` : ''}`)
}
if (treffers.length > MAX) console.log(`... en nog ${treffers.length - MAX} meer, zoek specifieker.`)
console.log(`\nBestandsnaam voor een cover: <id>-voor.jpg, bijvoorbeeld ${treffers[0].id}-voor.jpg`)
