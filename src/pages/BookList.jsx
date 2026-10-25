import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useBooks } from '../hooks/useBooks.js'
import BookCard from '../components/BookCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import FilterBar from '../components/FilterBar.jsx'
import Pagination from '../components/Pagination.jsx'
import { haalGenres, haalJaren, filterEnSorteerBoeken, paginaVan } from '../utils/filtering.js'
import { lijstStaatUitParams, lijstStaatNaarParams } from '../utils/lijstParams.js'

const PER_PAGINA = 48

function BookList() {
  const books = useBooks()

  // Zoekterm, filters, sortering en pagina staan in de URL (/boeken?jaar=2026&pagina=3), niet in useState.
  // Daardoor blijft de lijst bewaard als je een boek opent en terugkomt, en werkt de browserknop Terug.
  // "replace": een wijziging in de lijst vervangt het huidige geschiedenisitem in plaats van een nieuw toe te
  // voegen, zodat de knop Terug je niet door elke filterstap (of elke getypte letter) laat terugstappen.
  const [params, setParams] = useSearchParams()
  const { filters, pagina } = useMemo(() => lijstStaatUitParams(params), [params])
  const zetFilters = (nieuweFilters) => setParams(lijstStaatNaarParams(nieuweFilters, 1), { replace: true }) // terug naar pagina 1
  const zetPagina = (nummer) => setParams(lijstStaatNaarParams(filters, nummer), { replace: true })

  const genres = useMemo(() => haalGenres(books), [books])
  const jaren = useMemo(() => haalJaren(books), [books])
  const gefilterd = useMemo(() => filterEnSorteerBoeken(books, filters), [books, filters])
  const { items, huidige, totaalPaginas } = paginaVan(gefilterd, pagina, PER_PAGINA)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold">Alle boeken</h1>

      <SearchBar value={filters.zoekterm} onChange={(zoekterm) => zetFilters({ ...filters, zoekterm })} />
      <FilterBar genres={genres} jaren={jaren} filters={filters} onChange={zetFilters} />

      <p className="text-sm text-ink/60">
        {gefilterd.length} van {books.length} boeken
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>

      <Pagination pagina={huidige} totaalPaginas={totaalPaginas} onChange={zetPagina} />
    </div>
  )
}

export default BookList
