// Zet de toestand van de boekenlijst (zoekterm, filters, sortering, pagina) om naar URL-parameters en terug.
// Zo staat alles wat je in de lijst hebt ingesteld in het adres, bijvoorbeeld
//   /boeken?jaar=2026&sort=titel&pagina=3
// en komt de browserknop Terug (of een bladwijzer) altijd bij precies dezelfde lijst uit.
//
// In de URL staan alleen waarden die afwijken van de standaard, zodat /boeken zonder filters een schone URL blijft.
// Onbekende of ongeldige waarden (handmatig aangepaste URL) vallen stilletjes terug op de standaard.
import { STANDAARD_FILTERS } from './filtering.js'

const SORTERINGEN = ['datum-nieuw', 'datum-oud', 'titel', 'score']
const BEOORDELINGSFILTERS = ['alle', 'beoordeeld', 'onbeoordeeld']

function geheelGetal(tekst, min, max, standaard) {
  if (typeof tekst !== 'string' || !/^\d{1,9}$/.test(tekst)) return standaard
  const getal = Number(tekst)
  return getal >= min && getal <= max ? getal : standaard
}

// URLSearchParams -> { filters, pagina }
export function lijstStaatUitParams(params) {
  const beoordeling = params.get('beoordeling')
  const sortering = params.get('sort')
  const jaar = params.get('jaar') ?? ''
  const filters = {
    zoekterm: params.get('zoek') ?? '', // niet trimmen: anders kun je geen spatie meer typen in het zoekveld
    genre: params.get('genre') ?? '',
    beoordelingFilter: BEOORDELINGSFILTERS.includes(beoordeling) ? beoordeling : STANDAARD_FILTERS.beoordelingFilter,
    alleenFavorieten: params.get('favorieten') === '1',
    minScore: geheelGetal(params.get('min'), 1, 5, STANDAARD_FILTERS.minScore),
    jaar: /^\d{4}$/.test(jaar) ? jaar : '',
    sortering: SORTERINGEN.includes(sortering) ? sortering : STANDAARD_FILTERS.sortering,
  }
  return { filters, pagina: geheelGetal(params.get('pagina'), 1, 100000, 1) }
}

// { filters, pagina } -> URLSearchParams (alleen niet-standaardwaarden)
export function lijstStaatNaarParams(filters, pagina = 1) {
  const params = new URLSearchParams()
  const standaard = STANDAARD_FILTERS
  if (filters.zoekterm) params.set('zoek', filters.zoekterm)
  if (filters.genre) params.set('genre', filters.genre)
  if (filters.beoordelingFilter !== standaard.beoordelingFilter) params.set('beoordeling', filters.beoordelingFilter)
  if (filters.alleenFavorieten) params.set('favorieten', '1')
  if (filters.minScore > 0) params.set('min', String(filters.minScore))
  if (filters.jaar) params.set('jaar', filters.jaar)
  if (filters.sortering !== standaard.sortering) params.set('sort', filters.sortering)
  if (pagina > 1) params.set('pagina', String(pagina))
  return params
}
