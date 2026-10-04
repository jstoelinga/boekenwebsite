// Pure functies (geen React, geen state) voor het filteren en sorteren van boeken.
// Apart gezet van BookList.jsx zodat de logica leesbaar blijft en zonder browser te testen is.

export const STANDAARD_FILTERS = {
  zoekterm: '',
  genre: '',
  beoordelingFilter: 'alle', // 'alle' | 'beoordeeld' | 'onbeoordeeld'
  alleenFavorieten: false,
  minScore: 0, // 0 = geen ondergrens
  jaar: '',
  sortering: 'datum-nieuw', // 'datum-nieuw' | 'datum-oud' | 'titel' | 'score'
}

export function haalGenres(boeken) {
  return [...new Set(boeken.map((b) => b.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'))
}

export function haalJaren(boeken) {
  return [...new Set(boeken.map((b) => b.datum_gelezen?.slice(0, 4)).filter(Boolean))].sort().reverse()
}

export function filterBoeken(boeken, filters) {
  const term = filters.zoekterm.trim().toLowerCase()
  return boeken.filter((b) => {
    if (term && !`${b.titel} ${b.auteur}`.toLowerCase().includes(term)) return false
    if (filters.genre && b.genre !== filters.genre) return false
    if (filters.beoordelingFilter === 'beoordeeld' && !b.beoordeling) return false
    if (filters.beoordelingFilter === 'onbeoordeeld' && b.beoordeling) return false
    if (filters.alleenFavorieten && !b.beoordeling?.favoriet) return false
    if (filters.minScore > 0 && (!b.beoordeling || b.beoordeling.score < filters.minScore)) return false
    if (filters.jaar && b.datum_gelezen?.slice(0, 4) !== filters.jaar) return false
    return true
  })
}

// Boeken zonder leesdatum vallen altijd onderaan, ongeacht de sorteerrichting van de datum.
function vergelijkDatum(a, b, richting) {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  if (richting === 'oud') return a < b ? -1 : 1
  return a > b ? -1 : 1
}

export function sorteerBoeken(boeken, sortering) {
  const r = [...boeken]
  switch (sortering) {
    case 'datum-oud':
      return r.sort((a, b) => vergelijkDatum(a.datum_gelezen, b.datum_gelezen, 'oud'))
    case 'titel':
      return r.sort((a, b) => a.titel.localeCompare(b.titel, 'nl'))
    case 'score':
      return r.sort((a, b) => (b.beoordeling?.score ?? -1) - (a.beoordeling?.score ?? -1))
    case 'datum-nieuw':
    default:
      return r.sort((a, b) => vergelijkDatum(a.datum_gelezen, b.datum_gelezen, 'nieuw'))
  }
}

export function filterEnSorteerBoeken(boeken, filters) {
  return sorteerBoeken(filterBoeken(boeken, filters), filters.sortering)
}

export function paginaVan(lijst, pagina, perPagina) {
  const totaalPaginas = Math.max(1, Math.ceil(lijst.length / perPagina))
  const huidige = Math.min(Math.max(1, pagina), totaalPaginas)
  const start = (huidige - 1) * perPagina
  return { items: lijst.slice(start, start + perPagina), huidige, totaalPaginas }
}
