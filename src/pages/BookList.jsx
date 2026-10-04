import { useState, useMemo, useEffect } from 'react'
import { useBooks } from '../hooks/useBooks.js'
import BookCard from '../components/BookCard.jsx'
import SearchBar from '../components/SearchBar.jsx'
import FilterBar from '../components/FilterBar.jsx'
import Pagination from '../components/Pagination.jsx'
import { STANDAARD_FILTERS, haalGenres, haalJaren, filterEnSorteerBoeken, paginaVan } from '../utils/filtering.js'

const PER_PAGINA = 48

function BookList() {
  const books = useBooks()
  const [filters, setFilters] = useState(STANDAARD_FILTERS)
  const [pagina, setPagina] = useState(1)

  const genres = useMemo(() => haalGenres(books), [books])
  const jaren = useMemo(() => haalJaren(books), [books])
  const gefilterd = useMemo(() => filterEnSorteerBoeken(books, filters), [books, filters])
  const { items, huidige, totaalPaginas } = paginaVan(gefilterd, pagina, PER_PAGINA)

  // Terug naar pagina 1 zodra een filter verandert (anders kun je op een lege pagina belanden).
  useEffect(() => setPagina(1), [filters])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold">Alle boeken</h1>

      <SearchBar value={filters.zoekterm} onChange={(zoekterm) => setFilters({ ...filters, zoekterm })} />
      <FilterBar genres={genres} jaren={jaren} filters={filters} onChange={setFilters} />

      <p className="text-sm text-ink/60">
        {gefilterd.length} van {books.length} boeken
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {items.map((b) => (
          <BookCard key={b.id} book={b} />
        ))}
      </div>

      <Pagination pagina={huidige} totaalPaginas={totaalPaginas} onChange={setPagina} />
    </div>
  )
}

export default BookList
