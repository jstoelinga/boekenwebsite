// Tests voor bewerkVelden.js. Draaien: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BEWERK_VELDEN, beginwaarden, maakWijziging, isIsbnVastgelegd } from './bewerkVelden.js'

const volledig = {
  id: '9780261102217', isbn: '9780261102217', goodreads_id: '5907', titel: 'The Hobbit', auteur: 'J.R.R. Tolkien',
  datum_gelezen: '2025-11-02', paginas: 310, jaar_origineel: 1937,
  beoordeling: { id: '9780261102217', score: 5, favoriet: true, notitie: 'Prachtig.' },
}
const kaal = { id: 'gr-777', goodreads_id: '777', titel: 'Boek zonder ISBN', auteur: 'Ergens Iemand', datum_gelezen: null, beoordeling: null }

test('bewerkvelden: beginwaarden tonen een volledig boek zoals het is opgeslagen', () => {
  assert.deepEqual(beginwaarden(volledig), {
    titel: 'The Hobbit', auteur: 'J.R.R. Tolkien', isbn: '9780261102217', goodreads: 'https://www.goodreads.com/book/show/5907',
    datum_gelezen: '2025-11-02', paginas: '310', jaar_origineel: '1937', score: 5, favoriet: true, notitie: 'Prachtig.',
  })
})

test('bewerkvelden: ontbrekende velden worden lege invoervelden (geen "undefined" of "null")', () => {
  assert.deepEqual(beginwaarden(kaal), {
    titel: 'Boek zonder ISBN', auteur: 'Ergens Iemand', isbn: '', goodreads: 'https://www.goodreads.com/book/show/777',
    datum_gelezen: '', paginas: '', jaar_origineel: '', score: null, favoriet: false, notitie: '',
  })
})

test('bewerkvelden: een ongewijzigd formulier stuurt niets', () => {
  for (const boek of [volledig, kaal]) assert.deepEqual(maakWijziging(boek, beginwaarden(boek)), { wijzigingen: {}, origineel: {} })
})

test('bewerkvelden: alleen echt gewijzigde velden gaan mee, met hun opgeslagen oorspronkelijke waarde', () => {
  const waarden = { ...beginwaarden(volledig), titel: 'The Hobbit, herzien', paginas: '', notitie: '' }
  assert.deepEqual(maakWijziging(volledig, waarden), {
    wijzigingen: { titel: 'The Hobbit, herzien', paginas: '', notitie: '' },
    origineel: { titel: 'The Hobbit', paginas: 310, notitie: 'Prachtig.' },
  })
})

test('bewerkvelden: een onbeoordeeld boek heeft oorspronkelijk score null, favoriet false en notitie null', () => {
  const waarden = { ...beginwaarden(kaal), score: 4, favoriet: true, notitie: 'Goed' }
  assert.deepEqual(maakWijziging(kaal, waarden), {
    wijzigingen: { score: 4, favoriet: true, notitie: 'Goed' },
    origineel: { score: null, favoriet: false, notitie: null },
  })
})

test('bewerkvelden: de Goodreads-link wissen stuurt een lege waarde, met het opgeslagen id als origineel', () => {
  const waarden = { ...beginwaarden(volledig), goodreads: '' }
  assert.deepEqual(maakWijziging(volledig, waarden), { wijzigingen: { goodreads: '' }, origineel: { goodreads: '5907' } })
})

test('bewerkvelden: het ISBN van een boek waarvan het ISBN het id is kan niet worden meegestuurd', () => {
  assert.equal(isIsbnVastgelegd(volledig), true)
  assert.equal(isIsbnVastgelegd(kaal), false)
  const waarden = { ...beginwaarden(volledig), isbn: '9780306406157' }
  assert.deepEqual(maakWijziging(volledig, waarden), { wijzigingen: {}, origineel: {} })
  const bij = { ...beginwaarden(kaal), isbn: '9780306406157' }
  assert.deepEqual(maakWijziging(kaal, bij).wijzigingen, { isbn: '9780306406157' })
})

test('bewerkvelden: elk veld heeft een unieke sleutel, een soort en begin/origineel-functies', () => {
  const sleutels = BEWERK_VELDEN.map((v) => v.sleutel)
  assert.equal(new Set(sleutels).size, sleutels.length)
  for (const veld of BEWERK_VELDEN) {
    assert.ok(['tekst', 'datum', 'getal', 'sterren', 'schakelaar', 'tekstvak'].includes(veld.soort), veld.sleutel)
    assert.equal(typeof veld.begin, 'function')
    assert.equal(typeof veld.origineel, 'function')
  }
})
