import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import StarPicker from '../components/StarPicker.jsx'
import { useBoekenApi } from '../hooks/useBoekenApi.js'
import { useBook, werkBoekBij } from '../hooks/useBooks.js'
import { wijzigBoek } from '../api/boekenApi.js'
import { BEWERK_VELDEN, beginwaarden, maakWijziging } from '../utils/bewerkVelden.js'

const inputCls = 'w-full border border-ink/20 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-gold disabled:bg-ink/5 disabled:text-ink/50'
const knopCls = 'px-4 py-2 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed'
// Zelfde grens als bij "Boek toevoegen": nooit later dan de UTC-datum van vandaag (validate-data.js rekent met UTC).
const maxDatum = () => new Date().toISOString().slice(0, 10)
const MAX_COVER_MB = 15

function leesAlsDataUrl(bestand) {
  return new Promise((resolve, reject) => {
    const lezer = new FileReader()
    lezer.onload = () => resolve(lezer.result)
    lezer.onerror = () => reject(lezer.error)
    lezer.readAsDataURL(bestand)
  })
}

function Veld({ id, label, hint, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children}
      {hint && <p className="text-xs text-ink/50">{hint}</p>}
    </div>
  )
}

function BewerkFormulier({ boek }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [waarden, setWaarden] = useState(() => beginwaarden(boek))
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState(null) // { fout, veld?, soort?, bestaand? }
  const [melding, setMelding] = useState(null) // 'opgeslagen' | 'ongewijzigd'
  const [coverBestand, setCoverBestand] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)

  useEffect(() => {
    if (!coverBestand) {
      setCoverPreview(null)
      return
    }
    const url = URL.createObjectURL(coverBestand)
    setCoverPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [coverBestand])

  const { wijzigingen, origineel } = maakWijziging(boek, waarden)
  const aantalVeldenGewijzigd = Object.keys(wijzigingen).length
  const aantalWijzigingen = aantalVeldenGewijzigd + (coverBestand ? 1 : 0)
  // De foutmelding zelf staat in het rode blok onderaan, vlak bij de knop waarop je klikte (het formulier is lang,
  // een melding bij een veld bovenaan zou je kunnen missen). Het betreffende veld krijgt een rode rand.
  const heeftFout = (sleutel) => fout?.veld === sleutel
  const veldCls = (sleutel) => `${inputCls} ${heeftFout(sleutel) ? 'border-red-500' : ''}`

  const zet = (sleutel, waarde) => {
    setWaarden({ ...waarden, [sleutel]: waarde })
    setFout(null)
    setMelding(null)
  }

  // Terug naar de detailpagina. Kwamen we daar vandaan, dan is dat één stap terug in de geschiedenis (geen
  // extra item, dus geen lus). Is dit formulier rechtstreeks geopend, dan vervangen we het door de detailpagina.
  const terugNaarBoek = () => {
    if (location.state?.vanDetail) navigate(-1)
    else navigate(`/boeken/${boek.id}`, { replace: true })
  }

  const annuleren = () => {
    if (aantalWijzigingen > 0 && !window.confirm('Je wijzigingen zijn nog niet opgeslagen en gaan verloren. Doorgaan?')) return
    terugNaarBoek()
  }

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
    setMelding(null)
    setCoverBestand(bestand)
  }

  async function opslaan(e) {
    e.preventDefault()
    if (!waarden.titel.trim()) return setFout({ fout: 'Een boek heeft een titel nodig.', veld: 'titel' })
    if (aantalWijzigingen === 0) return setMelding('ongewijzigd')

    setBezig(true)
    setFout(null)
    setMelding(null)

    let cover = null
    if (coverBestand) {
      try {
        cover = await leesAlsDataUrl(coverBestand)
      } catch {
        setBezig(false)
        return setFout({ fout: 'De nieuwe coverafbeelding kon niet worden gelezen.', veld: 'cover' })
      }
    }

    const resultaat = await wijzigBoek(boek.id, wijzigingen, origineel, cover)
    setBezig(false)
    if (!resultaat.ok) return setFout(resultaat.fout)

    werkBoekBij(resultaat.data) // boek en nieuwe cover direct zichtbaar in de collectie
    setWaarden(beginwaarden({ ...resultaat.data.boek, beoordeling: resultaat.data.beoordeling }))
    setCoverBestand(null)
    const invoer = document.getElementById('nieuwe-cover')
    if (invoer) invoer.value = ''
    setMelding(resultaat.data.ongewijzigd ? 'ongewijzigd' : 'opgeslagen')
  }

  const toonVeld = (veld) => {
    const waarde = waarden[veld.sleutel]
    const vast = veld.vast?.(boek)
    const hint = vast ? veld.vastHint : veld.hint
    const id = `veld-${veld.sleutel}`
    switch (veld.soort) {
      case 'sterren':
        return (
          <div key={veld.sleutel} className="space-y-1">
            <span className="block text-sm font-medium">{veld.label}</span>
            <StarPicker value={waarde} onChange={(n) => zet(veld.sleutel, n)} />
          </div>
        )
      case 'schakelaar':
        return (
          <div key={veld.sleutel} className="space-y-1">
            <label className="flex items-center gap-2 text-sm font-medium select-none">
              <input type="checkbox" id={id} checked={waarde} aria-invalid={heeftFout(veld.sleutel) || undefined} onChange={(e) => zet(veld.sleutel, e.target.checked)} />
              {veld.label}
            </label>
            {hint && <p className="text-xs text-ink/50">{hint}</p>}
          </div>
        )
      case 'tekstvak':
        return (
          <Veld key={veld.sleutel} id={id} label={veld.label} hint={hint}>
            <textarea id={id} rows={4} className={veldCls(veld.sleutel)} aria-invalid={heeftFout(veld.sleutel) || undefined} value={waarde} onChange={(e) => zet(veld.sleutel, e.target.value)} />
          </Veld>
        )
      default: {
        const type = veld.soort === 'datum' ? 'date' : 'text'
        return (
          <Veld key={veld.sleutel} id={id} label={veld.label} hint={hint}>
            <input
              id={id}
              type={type}
              max={veld.soort === 'datum' ? maxDatum() : undefined}
              inputMode={veld.soort === 'getal' ? 'numeric' : undefined}
              className={veldCls(veld.sleutel)}
              aria-invalid={heeftFout(veld.sleutel) || undefined}
              value={waarde}
              disabled={vast}
              onChange={(e) => zet(veld.sleutel, e.target.value)}
            />
          </Veld>
        )
      }
    }
  }

  return (
    <form className="max-w-2xl space-y-5" onSubmit={opslaan}>
      <div className="space-y-1">
        <h1 className="text-2xl font-serif font-bold">Boek bewerken</h1>
        <p className="text-sm text-ink/50">id: {boek.id} (verandert nooit)</p>
      </div>

      <div className="space-y-3 rounded-md border border-ink/10 bg-white p-4">
        <h2 className="font-medium">Boekcover vervangen</h2>
        <p className="text-sm text-ink/60">
          Kies een nieuwe afbeelding. De huidige cover blijft behouden als het opslaan mislukt.
          De vervanging wordt pas actief nadat de server de nieuwe afbeelding heeft opgeslagen.
        </p>
        <label htmlFor="nieuwe-cover" className="block text-sm font-medium">
          Nieuwe coverafbeelding
        </label>
        <input
          id="nieuwe-cover"
          type="file"
          accept="image/*"
          disabled={bezig}
          onChange={kiesCover}
          className="block w-full text-sm"
          aria-invalid={fout?.veld === 'cover' || undefined}
        />
        {fout?.veld === 'cover' && <p className="text-sm text-red-700">{fout.fout}</p>}
        {coverPreview && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Voorbeeld van de nieuwe cover</p>
            <img src={coverPreview} alt="Voorbeeld van de gekozen nieuwe cover" className="h-48 max-w-full rounded-md border border-ink/10 object-contain object-left" />
            <button
              type="button"
              disabled={bezig}
              onClick={() => {
                setCoverBestand(null)
                const invoer = document.getElementById('nieuwe-cover')
                if (invoer) invoer.value = ''
                setFout(null)
                setMelding(null)
              }}
              className="text-sm underline"
            >
              Gekozen vervanging annuleren
            </button>
          </div>
        )}
      </div>

      {BEWERK_VELDEN.map(toonVeld)}

      {melding === 'opgeslagen' && (
        <div role="status" className="text-sm text-green-900 bg-green-50 border border-green-200 rounded-md px-3 py-2 flex flex-wrap items-center gap-3">
          <span>✓ Wijzigingen opgeslagen.</span>
          <button type="button" onClick={terugNaarBoek} className="underline">Terug naar het boek</button>
        </div>
      )}
      {melding === 'ongewijzigd' && (
        <p role="status" className="text-sm text-ink/70 bg-ink/5 border border-ink/10 rounded-md px-3 py-2">Er waren geen wijzigingen om op te slaan.</p>
      )}

      {fout && (
        <div role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-md px-3 py-2 space-y-1">
          <p>{fout.fout}</p>
          {fout.bestaand && <Link to={`/boeken/${fout.bestaand.id}`} className="underline">Bekijk dat boek</Link>}
          {fout.soort === 'conflict' && (
            <button type="button" onClick={() => window.location.reload()} className="underline">Pagina herladen</button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={bezig || aantalWijzigingen === 0} className={`${knopCls} bg-moss text-cream hover:opacity-90`}>
          {bezig ? 'Opslaan…' : 'Wijzigingen opslaan'}
        </button>
        <button type="button" onClick={annuleren} disabled={bezig} className={`${knopCls} border border-ink/20 bg-white hover:border-gold`}>
          Annuleren
        </button>
        <span className="text-sm text-ink/50">
          {aantalWijzigingen === 0
            ? 'Geen wijzigingen'
            : `${aantalVeldenGewijzigd} ${aantalVeldenGewijzigd === 1 ? 'veld' : 'velden'}${coverBestand ? ' + nieuwe cover' : ''}`}
        </span>
      </div>
    </form>
  )
}

function BoekBewerken() {
  const { id } = useParams()
  const boek = useBook(id)
  const api = useBoekenApi()

  if (!boek) {
    return (
      <div className="space-y-3">
        <p>Boek niet gevonden.</p>
        <Link to="/boeken" className="text-gold underline">← Naar de boekenlijst</Link>
      </div>
    )
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
        <Link to={`/boeken/${boek.id}`} className="text-gold underline">← Terug naar het boek</Link>
      </div>
    )
  }

  // key={boek.id}: bij een ander boek begint het formulier met de waarden van dat boek.
  return <BewerkFormulier key={boek.id} boek={boek} />
}

export default BoekBewerken
