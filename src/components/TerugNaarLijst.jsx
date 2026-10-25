import { Link, useLocation, useNavigate } from 'react-router-dom'

// Alleen deze twee herkomsten kennen we; alles wat BookCard meegeeft (state.van) wordt hier gecontroleerd.
function herkomst(van) {
  if (typeof van !== 'string') return null
  if (van === '/boeken' || van.startsWith('/boeken?')) return { naar: van, label: 'Terug naar boekenlijst' }
  if (van === '/') return { naar: '/', label: 'Terug naar home' }
  return null
}

// "Terug"-link op een boekpagina.
//  - Kwam je via de lijst (of home) hierheen: dan gaat dit één stap terug in de browsergeschiedenis. Dat is
//    precies dezelfde lijst, met dezelfde filters, sortering, zoekopdracht en pagina. Het is bewust géén nieuwe
//    navigatie naar de lijst: die zou een extra geschiedenisitem toevoegen, en dan komt de browserknop Terug
//    weer op deze pagina uit (een lus).
//  - Open je het boek rechtstreeks (bladwijzer, nieuw tabblad), dan is er geen lijst om naar terug te gaan: dan
//    gaat dit naar /boeken, en vervangt het deze pagina in de geschiedenis (ook dan geen lus).
function TerugNaarLijst({ className = 'text-gold underline text-sm' }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const bron = herkomst(state?.van)

  if (bron) {
    return (
      <Link
        to={bron.naar}
        className={className}
        onClick={(e) => {
          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return // "open in nieuw tabblad" werkt gewoon
          e.preventDefault()
          navigate(-1)
        }}
      >
        ← {bron.label}
      </Link>
    )
  }
  return (
    <Link to="/boeken" replace className={className}>
      ← Terug naar boekenlijst
    </Link>
  )
}

export default TerugNaarLijst
