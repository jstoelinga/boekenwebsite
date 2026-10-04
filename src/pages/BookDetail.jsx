import { useParams, Link } from 'react-router-dom'
import { useBook } from '../hooks/useBooks.js'
import CoverImage from '../components/CoverImage.jsx'
import Stars from '../components/Stars.jsx'

function BookDetail() {
  const { id } = useParams()
  const book = useBook(id)

  if (!book) {
    return (
      <div className="space-y-3">
        <p>Boek niet gevonden.</p>
        <Link to="/boeken" className="text-gold underline">← Terug naar overzicht</Link>
      </div>
    )
  }

  const { beoordeling } = book
  // Toon de Nederlandse beschrijving als die er is, anders het origineel met een label.
  const beschrijving = book.beschrijving_nl || book.beschrijving
  const isOriginalEnVertaaldNiet = !book.beschrijving_nl && book.beschrijving_taal && book.beschrijving_taal !== 'nl'
  const goodreadsLink = book.goodreads_id ? `https://www.goodreads.com/book/show/${book.goodreads_id}` : null

  return (
    <div className="space-y-6">
      <Link to="/boeken" className="text-gold underline text-sm">← Terug naar overzicht</Link>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-48 aspect-[2/3] shrink-0 rounded-md border border-ink/10 overflow-hidden">
          <CoverImage candidates={book.coverVoor} alt={`Cover van ${book.titel}`} className="w-full h-full object-cover" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-serif font-bold">{book.titel}</h1>
          <p className="text-ink/70">door {book.auteur}</p>

          <p className="text-sm flex flex-wrap items-center gap-2">
            {book.genre && <span className="px-2 py-0.5 bg-moss/10 text-moss rounded">{book.genre}</span>}
            {book.jaar_origineel != null && <span className="text-ink/50">oorspr. {book.jaar_origineel}</span>}
            {book.paginas && <span className="text-ink/50">{book.paginas} pagina's</span>}
          </p>

          {beoordeling ? (
            <div className="flex items-center gap-2">
              <Stars score={beoordeling.score} />
              {beoordeling.favoriet && <span className="text-gold text-sm">♥ favoriet</span>}
            </div>
          ) : (
            <p className="text-sm text-ink/40 italic">Nog niet door mij beoordeeld</p>
          )}

          {book.goodreads_score != null && (
            <p className="text-sm text-ink/60">Gemiddelde Goodreads-score: {book.goodreads_score.toFixed(2)} / 5</p>
          )}
          {book.datum_gelezen && <p className="text-sm text-ink/50">Gelezen op {book.datum_gelezen}</p>}

          {goodreadsLink && (
            <p className="text-sm pt-2">
              <a href={goodreadsLink} target="_blank" rel="noreferrer" className="text-gold underline">
                Bekijk op Goodreads
              </a>
            </p>
          )}
        </div>
      </div>

      {beschrijving && (
        <div>
          <h2 className="font-serif font-semibold text-lg">
            Samenvatting
            {isOriginalEnVertaaldNiet && (
              <span className="ml-2 text-xs font-sans font-normal text-ink/40">
                (originele, {book.beschrijving_taal === 'en' ? 'Engelse' : 'anderstalige'} beschrijving)
              </span>
            )}
          </h2>
          <p className="text-ink/80 whitespace-pre-line">{beschrijving}</p>
        </div>
      )}

      {beoordeling?.notitie && (
        <div>
          <h2 className="font-serif font-semibold text-lg">Mijn notitie</h2>
          <p className="text-ink/80 whitespace-pre-line">{beoordeling.notitie}</p>
        </div>
      )}

      {book.coverAchter.length > 0 && (
        <div>
          <h2 className="font-serif font-semibold text-lg">Achterkant</h2>
          <div className="w-48 aspect-[2/3] rounded-md border border-ink/10 overflow-hidden">
            <CoverImage candidates={book.coverAchter} alt="Achterkant van het boek" className="w-full h-full object-cover" />
          </div>
        </div>
      )}
    </div>
  )
}

export default BookDetail
