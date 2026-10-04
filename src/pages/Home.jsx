import { Link } from 'react-router-dom'
import { useBooks } from '../hooks/useBooks.js'
import BookCard from '../components/BookCard.jsx'

function StatBlok({ label, waarde }) {
  return (
    <div className="bg-white border border-ink/10 rounded-md px-4 py-3">
      <div className="text-2xl font-serif font-bold">{waarde}</div>
      <div className="text-xs text-ink/50">{label}</div>
    </div>
  )
}

function Home() {
  const books = useBooks()
  const ditJaar = String(new Date().getFullYear())

  const beoordeeld = books.filter((b) => b.beoordeling)
  const favorieten = books.filter((b) => b.beoordeling?.favoriet)
  const perJaar = books.reduce((acc, b) => {
    const jaar = b.datum_gelezen?.slice(0, 4)
    if (jaar) acc[jaar] = (acc[jaar] ?? 0) + 1
    return acc
  }, {})
  const jarenAflopend = Object.entries(perJaar).sort((a, b) => b[0].localeCompare(a[0]))

  const recent = [...books]
    .filter((b) => b.datum_gelezen)
    .sort((a, b) => (b.datum_gelezen > a.datum_gelezen ? 1 : -1))
    .slice(0, 6)

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-serif font-bold">Mijn Boekenbibliotheek</h1>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatBlok label="boeken gelezen" waarde={books.length} />
          <StatBlok label="door mij beoordeeld" waarde={beoordeeld.length} />
          <StatBlok label="favorieten" waarde={favorieten.length} />
          <StatBlok label={`gelezen in ${ditJaar}`} waarde={perJaar[ditJaar] ?? 0} />
        </div>
        <p>
          <Link to="/boeken" className="text-gold underline">Bekijk alle boeken →</Link>
        </p>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-xl font-serif font-semibold mb-3">Recent gelezen</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {recent.map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
        </section>
      )}

      {favorieten.length > 0 && (
        <section>
          <h2 className="text-xl font-serif font-semibold mb-3">Favorieten</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {favorieten.slice(0, 12).map((b) => (
              <BookCard key={b.id} book={b} />
            ))}
          </div>
          {favorieten.length > 12 && (
            <p className="text-sm text-ink/50 mt-2">en nog {favorieten.length - 12} meer favorieten...</p>
          )}
        </section>
      )}

      {jarenAflopend.length > 0 && (
        <section>
          <h2 className="text-xl font-serif font-semibold mb-3">Per jaar</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {jarenAflopend.map(([jaar, aantal]) => (
              <span key={jaar} className="px-3 py-1 bg-white border border-ink/10 rounded-full">
                {jaar}: {aantal}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export default Home
