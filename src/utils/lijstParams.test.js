// Tests voor lijstParams.js. Draaien: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STANDAARD_FILTERS } from './filtering.js'
import { lijstStaatUitParams, lijstStaatNaarParams } from './lijstParams.js'

const parse = (zoekdeel) => lijstStaatUitParams(new URLSearchParams(zoekdeel))

test('lijstparams: de standaardlijst geeft een lege, schone URL en omgekeerd', () => {
  assert.equal(lijstStaatNaarParams(STANDAARD_FILTERS, 1).toString(), '')
  assert.deepEqual(parse(''), { filters: STANDAARD_FILTERS, pagina: 1 })
})

test('lijstparams: alleen afwijkende waarden komen in de URL', () => {
  assert.equal(lijstStaatNaarParams({ ...STANDAARD_FILTERS, jaar: '2026' }, 1).toString(), 'jaar=2026')
  assert.equal(lijstStaatNaarParams({ ...STANDAARD_FILTERS, jaar: '2026', sortering: 'titel' }, 3).toString(), 'jaar=2026&sort=titel&pagina=3')
  assert.equal(lijstStaatNaarParams(STANDAARD_FILTERS, 1).has('pagina'), false, 'pagina 1 hoeft er niet in')
})

test('lijstparams: een volledige toestand overleeft heen en weer (het scenario jaar 2026, pagina 3)', () => {
  const filters = { zoekterm: 'de dolly', genre: 'Fantasy', beoordelingFilter: 'beoordeeld', alleenFavorieten: true, minScore: 4, jaar: '2026', sortering: 'titel' }
  const url = lijstStaatNaarParams(filters, 3).toString()
  assert.deepEqual(parse(url), { filters, pagina: 3 })
  // En via een echte URL zoals de browser hem bewaart:
  assert.deepEqual(parse('?jaar=2026&sort=titel&pagina=3').filters.jaar, '2026')
  assert.equal(parse('?jaar=2026&sort=titel&pagina=3').pagina, 3)
})

test('lijstparams: speciale tekens in de zoekterm (spaties, &, =, +, accenten) blijven kloppen', () => {
  for (const zoekterm of ['a&b=c', 'café ünï', '1+1=2', 'dubbele  spatie', 'eindigt op spatie ', '100%', '#hashtag?']) {
    const url = lijstStaatNaarParams({ ...STANDAARD_FILTERS, zoekterm }, 1).toString()
    assert.equal(parse(url).filters.zoekterm, zoekterm, zoekterm)
  }
})

test('lijstparams: ongeldige waarden in een handmatig aangepaste URL vallen terug op de standaard', () => {
  const s = STANDAARD_FILTERS
  assert.equal(parse('?sort=onzin').filters.sortering, s.sortering)
  assert.equal(parse('?beoordeling=x').filters.beoordelingFilter, s.beoordelingFilter)
  assert.equal(parse('?jaar=26').filters.jaar, '')
  assert.equal(parse('?jaar=2026abc').filters.jaar, '')
  assert.equal(parse('?min=9').filters.minScore, s.minScore)
  assert.equal(parse('?min=-1').filters.minScore, s.minScore)
  assert.equal(parse('?favorieten=ja').filters.alleenFavorieten, false)
  for (const pagina of ['abc', '0', '-2', '3abc', '1.5', '', '99999999999']) {
    assert.equal(parse(`?pagina=${pagina}`).pagina, 1, `pagina=${pagina}`)
  }
})
