import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import BookCard from '../components/BookCard.jsx'
import StarPicker from '../components/StarPicker.jsx'
import { useBoekenApi } from '../hooks/useBoekenApi.js'
import { useBook, voegBoekToe } from '../hooks/useBooks.js'
import { slaBoekOp } from '../api/boekenApi.js'

const MAX_COVER_MB = 15
const inputCls = 'w-full border border-ink/20 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-gold'
const knopCls = 'px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'

// De datumkiezer mag niet verder gaan dan de UTC-datum van vandaag: validate-data.js vergelijkt datums
// met UTC en zou een "lokale" datum die al op morgen valt als toekomst afkeuren.
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

function NieuwBoek() {
  const api = useBoekenApi()
  const grenzen = datumGrenzen()

  const leeg = { titel: '', auteur: '', isbn: '', goodreads: '', datum: grenzen.standaard, notitie: '' }
  const [velden, setVelden] = useState(leeg)
  const [score, setScore] = useState(null)
  const [coverBestand, setCoverBestand] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [fout, setFout] = useState(null)
  const [bezig, setBezig] = useState(false)
  const [opgeslagen, setOpgeslagen] = useState(null) // { id, waarschuwingen }
  const opgeslagenBoek = useBook(opgeslagen?.id ?? null)

  useEffect(() => {
    if (!coverBestand) return setCoverPreview(null)
    const url = URL.createObjectURL(coverBestand)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverBestand])

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
  }

  async function verstuur(forceer) {
    setBezig(true)
    setFout(null)
    let cover = null
    if (coverBestand) {
      try {
        cover = await leesAlsDataUrl(coverBestand)
      } catch {
        setBezig(false)
        return setFout({ fout: 'De coverafbeelding kon niet worden gelezen.', veld: 'cover' })
      }
    }
    const resultaat = await slaBoekOp({
      titel: velden.titel,
      auteur: velden.auteur,
      isbn: velden.isbn,
      goodreads: velden.goodreads,
      datum_gelezen: velden.datum || null,
      score,
      notitie: velden.notitie,
      cover,
      forceer,
    })
    setBezig(false)
    if (!resultaat.ok) return setFout(resultaat.fout)
    voegBoekToe(resultaat.data) // meteen zichtbaar in de collectie
    setOpgeslagen({ id: resultaat.data.boek.id, waarschuwingen: resultaat.data.waarschuwingen ?? [] })
  }

  function opnieuw() {
    setVelden({ ...leeg, datum: datumGrenzen().standaard })
    setScore(null)
    setCoverBestand(null)
    setFout(null)
    setOpgeslagen(null)
  }

  if (api === null) return <p className="text-ink/50">Even controleren of opslaan mogelijk is…</p>

  if (api === false) {
    return (
      <div className="max-w-2xl space-y-3">
        <h1 className="text-2xl font-serif font-bold">Boek toevoegen</h1>
        <p>
          Boeken toevoegen kan alleen op je eigen pc, terwijl de website lokaal draait. Start hem met{' '}
          <code className="bg-white border border-ink/10 rounded px-1.5 py-0.5 text-sm">npm run dev</code> en open{' '}
          <code className="bg-white border border-ink/10 rounded px-1.5 py-0.5 text-sm">http://localhost:5173/boekenwebsite/</code>.
        </p>
        <p className="text-sm text-ink/60">In de gepubliceerde versie op GitHub Pages bestaat deze functie bewust niet.</p>
        <Link to="/boeken" className="text-gold underline">← Naar alle boeken</Link>
      </div>
    )
  }

  if (opgeslagen) {
    return (
      <div className="max-w-2xl space-y-5">
        <h1 className="text-2xl font-serif font-bold">✓ Opgeslagen in je collectie</h1>
        {opgeslagen.waarschuwingen.map((w) => (
          <p key={w} className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">{w}</p>
        ))}
        {opgeslagenBoek && (
          <div className="w-44">
            <BookCard book={opgeslagenBoek} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <button type="button" onClick={opnieuw} className={`${knopCls} bg-moss text-cream hover:opacity-90`}>
            Nog een boek toevoegen
          </button>
          <Link to={`/boeken/${opgeslagen.id}`} className="text-gold underline">Bekijk dit boek</Link>
          <Link to="/boeken" className="text-gold underline">Alle boeken</Link>
        </div>
      </div>
    )
  }

  return (
    <form
      className="max-w-2xl space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        if (!velden.titel.trim()) return setFout({ fout: 'Vul een titel in.', veld: 'titel' })
        verstuur(false)
      }}
    >
      <h1 className="text-2xl font-serif font-bold">Boek toevoegen</h1>

      <Veld id="titel" label="Titel *" fout={veldFout('titel')}>
        <input id="titel" className={inputCls} value={velden.titel} onChange={wijzig('titel')} required autoFocus />
      </Veld>

      <Veld id="auteur" label="Auteur" hint={`Leeg laten? Dan wordt “Onbekende auteur” opgeslagen.`} fout={veldFout('auteur')}>
        <input id="auteur" className={inputCls} value={velden.auteur} onChange={wijzig('auteur')} />
      </Veld>

      <Veld id="isbn" label="ISBN" hint="ISBN-10 of ISBN-13, met of zonder streepjes. Zo herkennen we ook dubbele boeken." fout={veldFout('isbn')}>
        <input id="isbn" className={inputCls} value={velden.isbn} onChange={wijzig('isbn')} inputMode="numeric" />
      </Veld>

      <Veld id="goodreads" label="Goodreads-link" hint="Optioneel. Plak de link van de boekpagina op Goodreads; dan krijgt het boek een knop naar Goodreads." fout={veldFout('goodreads')}>
        <input id="goodreads" className={inputCls} value={velden.goodreads} onChange={wijzig('goodreads')} placeholder="https://www.goodreads.com/book/show/…" />
      </Veld>

      <Veld id="datum" label="Leesdatum" hint="Standaard vandaag. Wis de datum als je hem niet weet; het boek komt dan onderaan de lijst." fout={veldFout('datum_gelezen')}>
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

      <Veld id="cover" label="Coverafbeelding (optioneel)" hint="Kies een afbeelding op je pc. Hij wordt automatisch verkleind. Zonder cover kan het boek ook gewoon worden opgeslagen." fout={veldFout('cover')}>
        <input id="cover" type="file" accept="image/*" onChange={kiesCover} className="block text-sm" />
        {coverPreview && (
          <div className="flex items-end gap-3 pt-2">
            <img src={coverPreview} alt="Voorbeeld van de gekozen cover" className="h-40 rounded-md border border-ink/10" />
            <button
              type="button"
              className="text-sm text-gold underline"
              onClick={() => {
                setCoverBestand(null)
                document.getElementById('cover').value = ''
              }}
            >
              Cover verwijderen
            </button>
          </div>
        )}
      </Veld>

      {algemeneFout && <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2">{algemeneFout}</p>}

      {(fout?.soort === 'isbn-dubbel' || fout?.soort === 'goodreads-dubbel') && (
        <div role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 space-y-1">
          <p>{fout.fout}</p>
          <Link to={`/boeken/${fout.bestaand.id}`} className="underline">Bekijk het bestaande boek</Link>
        </div>
      )}

      {fout?.soort === 'titel-dubbel' && (
        <div role="alert" className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-2">
          <p>{fout.fout}</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to={`/boeken/${fout.bestaand.id}`} className="underline">Bekijk het bestaande boek</Link>
            <button type="button" disabled={bezig} onClick={() => verstuur(true)} className={`${knopCls} bg-amber-700 text-white hover:opacity-90`}>
              Toch toevoegen
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <button type="submit" disabled={bezig} className={`${knopCls} bg-moss text-cream hover:opacity-90`}>
          {bezig ? 'Opslaan…' : 'Boek opslaan'}
        </button>
        <Link to="/boeken" className="text-sm text-ink/60 underline">Annuleren</Link>
      </div>
    </form>
  )
}

export default NieuwBoek
