import { Link, useLocation } from 'react-router-dom'
import CoverImage from './CoverImage.jsx'
import Stars from './Stars.jsx'

function BookCard({ book }) {
  const location = useLocation()
  const jaar = book.datum_gelezen ? book.datum_gelezen.slice(0, 4) : null

  return (
    <Link
      to={`/boeken/${book.id}`}
      // Onthoud waar je vandaan kwam (bijvoorbeeld /boeken?jaar=2026&pagina=3), zodat de terugknop daar weer uitkomt.
      state={{ van: location.pathname + location.search }}
      className="group block bg-white rounded-md border border-ink/10 overflow-hidden hover:border-gold hover:shadow-lg transition"
    >
      <div className="aspect-[2/3] overflow-hidden bg-ink/5">
        <CoverImage
          candidates={book.coverVoor}
          alt={`Cover van ${book.titel}`}
          className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
      <div className="p-3 space-y-1">
        <h3 className="font-serif font-semibold leading-tight line-clamp-2">{book.titel}</h3>
        <p className="text-sm text-ink/60 line-clamp-1">{book.auteur}</p>
        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="text-ink/40">{jaar ?? '—'}</span>
          {book.beoordeling ? (
            <Stars score={book.beoordeling.score} />
          ) : (
            <span className="text-ink/30 italic">onbeoordeeld</span>
          )}
        </div>
        {book.beoordeling?.favoriet && <span className="text-gold text-xs">♥ favoriet</span>}
      </div>
    </Link>
  )
}

export default BookCard
