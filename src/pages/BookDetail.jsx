import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import StarPicker from '../components/StarPicker.jsx'
import { useBoekenApi } from '../hooks/useBoekenApi.js'
import { useBook, updateBoekInState } from '../hooks/useBooks.js'
import { werkBoekBij } from '../api/boekenApi.js'

const MAX_COVER_MB = 15
const inputCls = 'w-full border border-ink/20 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-gold'
const knopCls = 'px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'

function datumGrenzen() {
  const nu = new Date()
  const utc = nu.toISOString().slice(0, 10)
  const lokaal = `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}-${String(nu.getDate()).padStart(2, '0')}`
  return { max: utc, standaard: lokaal < utc ? lokaal : utc }
}

function leesAlsDataUrl(bestand) {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader()
    lezer.onload = () => resolve(lezer.result)
    lezer.onerror = () => reject(lezer.error)
    lezer.readAsDataURL(bestand)
  })
}

function Veld({ id, label, hint, fout, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {fout ? <p className="text-xs text-red-700">{fout}</p> : hint && <p className="text-xs text-ink/50">{hint}</p>}
    </div>
  )
}

function BewerkBoek() {
  const api = useBoekenApi()
  const navigate = useNavigate()
  const { id } = useParams()
  const book = useBook(id)
  const grenzen = useMemo(() => datumGrenzen(), [])

  const [velden, setVelden] = useState({
    titel: '', auteur: '', goodreads: '', datum: grenzen.standaard, notitie: '',
  })
  const [score, setScore] = useState(null)
  const [coverBestand, setCoverBestand] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [verwijderCover, setVerwijderCover] = useState(false)
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)

  useEffect(() => {
    if (!book) return
    const goodreads = book.goodreads_id ? `https://www.goodreads.com/book/show/${book.goodreads_id}` : ''
    setVelden({
      titel: book.titel || '',
      auteur: book.auteur || '',
      goodreads,
      datum: book.datum_gelezen || grenzen.standaard,
      notitie: book.beoordeling?.notitie || '',
    })
    setScore(book.beoordeling?.score ?? null)
    setCoverBestand(null)
    setVerwijderCover(false)
    setCoverPreview(book.coverVoor[0] || null)
  }, [book, grenzen.standaard])

  useEffect(() => {
    if (!coverBestand) return setCoverPreview(book?.coverVoor?.[0] || null)
    const url = URL.createObjectURL(coverBestand)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverBestand, book])

  const wijzig = (veld) => (e) => {
    setVelden({ ...velden, [veld]: e.target.value })
    setFout(null)
  }

  const veldFout = (naam) => (fout?.veld === naam ? fout.fout : null)
  const algemeneFout = fout && !fout.veld && !fout.soort ? fout.fout : null

  function kiesCover(e) {
    const bestand = e.target.files?.[0] ?? null
    if (bestand && !bestand.type.startsWith('image/')) {
      setFout({ fout: 'Dat bestand is geen afbeelding.', veld: 'cover' })
      e.target.value = ''
      return setCoverBestand(null)
    }
    if (bestand && bestand.size > MAX_COVER_MB * 1024 * 1024) {
      setFout({ fout: `Deze afbeelding is groter dan ${MAX_COVER_MB} MB.`, veld: 'cover' })
      e.target.value = ''
      return setCoverBestand(null)
    }
    setFout(null)
    setCoverBestand(bestand)
    setVerwijderCover(false)
  }

  async function verstuur() {
    if (!book) return
    setBezig(true)
    setFout(null)

    let cover = null
    let coverActie = 'keep'
    if (coverBestand) {
      try {
        cover = await leesAlsDataUrl(coverBestand)
        coverActie = book.coverVoor?.[0] ? 'replace' : 'add'
      } catch {
        setBezig(false)
        return setFout({ fout: 'De coverafbeelding kon niet worden gelezen.', veld: 'cover' })
      }
    } else if (verwijderCover) {
      coverActie = 'remove'
    }

    const resultaat = await werkBoekBij(book.id, {
      titel: velden.titel,
      auteur: velden.auteur,
      goodreads: velden.goodreads,
      datum_gelezen: velden.datum || null,
      score,
      notitie: velden.notitie,
      cover,
      coverAction: coverActie,
    })

    setBezig(false)
    if (!resultaat.ok) return setFout(resultaat.fout)

    updateBoekInState({
      boek: resultaat.data.boek,
      beoordeling: resultaat.data.beoordeling,
      covers: result.data.covers,
    })
    navigate(`/boeken/${book.id}`)
  }

  if (api === null) return <p className="text-ink/50">Even controleren of opslaan mogelijk is…</p>
  if (api === false) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-serif font-bold">Boek bewerken</h1>
        <p>
          Bewerken kan alleen op je eigen pc, terwijl de website lokaal draait. Start hem met{' '}
          <code className="bg-white border border-ink/10 rounded px-1.5 py-0.5 text-sm">npm run dev</code> en open{' '}
          <code className="bg-white border border-ink/10 rounded px-1.5 py-0.5 text-sm">http://localhost:5173/boekenwebsite/</code>.
        </p>
        <Link to="/boeken" className="text-gold underline">← Naar alle boeken</Link>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="space-y-3">
        <p>Boek niet gevonden.</p>
        <Link to="/boeken" className="text-gold underline">← Terug naar overzicht</Link>
      </div>
    )
  }

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!velden.titel.trim()) return setFout({ fout: 'Vul een titel in.', veld: 'titel' })
        verstuur()
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold">Boek bewerken</h1>
        <Link to={`/boeken/${book.id}`} className="text-sm text-gold underline">Annuleren</Link>
      </div>

      <Veld id="titel" label="Titel *" fout={veldFout('titel')}>
        <input id="titel" className={inputCls} value={velden.titel} onChange={wijzig('titel')} required autoFocus />
      </Veld>

      <Veld id="auteur" label="Auteur" hint={`Leeg laten? Dan wordt “Onbekende auteur” opgeslagen.`} fout={veldFout('auteur')}>
        <input id="auteur" className={inputCls} value={velden.auteur} onChange={wijzig('auteur')} />
      </Veld>

      <Veld id="goodreads" label="Goodreads-link" hint="Optioneel. Plak de link van de boekpagina op Goodreads." fout={veldFout('goodreads')}>
        <input id="goodreads" className={inputCls} value={velden.goodreads} onChange={wijzig('goodreads')} placeholder="https://www.goodreads.com/book/show/…" />
      </Veld>

      <Veld id="datum" label="Leesdatum" hint="Standaard vandaag. Wis de datum als je hem niet weet." fout={veldFout('datum_gelezen')}>
        <input id="datum" type="date" max={grenzen.max} className={inputCls} value={velden.datum} onChange={wijzig('datum')} />
      </Veld>

      <div className="space-y-1">
        <span className="block text-sm font-medium">Beoordeling</span>
        <StarPicker value={score} onChange={(n) => { setScore(n); setFout(null) }} />
        {veldFout('score') && <p className="text-xs text-red-700">{veldFout('score')}</p>}
      </div>

      <Veld id="notitie" label="Persoonlijke opmerkingen" hint="Wordt samen met je beoordeling opgeslagen." fout={veldFout('notitie')}>
        <textarea id="notitie" rows={4} className={inputCls} value={velden.notitie} onChange={wijzig('notitie')} />
      </Veld>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="block text-sm font-medium">Cover</span>
          {book.coverVoor?.[0] && (
            <button type="button" className="text-sm text-gold underline" onClick={() => setVerwijderCover(true)}>
              Verwijder cover
            </button>
          )}
        </div>

        <input id="cover" type="file" accept="image/*" onChange={kiesCover} className="block text-sm" />

        {coverPreview && (
          <div className="flex items-end gap-3 pt-2">
            <img src={coverPreview} alt="Voorbeeld van de cover" className="h-40 rounded-md border border-ink/10" />
            {(book.coverVoor?.[0] || coverBestand) && (
              <button type="button" className="text-sm text-gold underline" onClick={() => {
                setCoverBestand(null)
                setVerwijderCover(false)
                setCoverPreview(book.coverVoor?.[0] || null)
                const input = document.getElementById('cover')
                if (input) input.value = ''
              }}>
                Reset
              </button>
            )}
          </div>
        )}

        {verwijderCover && !coverBestand && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            De cover wordt verwijderd bij het opslaan.
          </p>
        )}
      </div>

      {algemeneFout && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">{algemeneFout}</p>}

      <div className="flex items-center gap-4">
        <button type="submit" disabled={bezig} className={`${knopCls} bg-moss text-cream hover:opacity-90`}>
          {bezig ? 'Opslaan…' : 'Wijzigingen opslaan'}
        </button>
        <Link to={`/boeken/${book.id}`} className="text-sm text-ink/60 underline">Annuleren</Link>
      </div>
    </form>
  )
}

export default BewerkBoek
