import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import BookList from './pages/BookList.jsx'
import BookDetail from './pages/BookDetail.jsx'
import NieuwBoek from './pages/NieuwBoek.jsx'
import { useBoekenApi } from './hooks/useBoekenApi.js'

function App() {
  // De knop "Boek toevoegen" bestaat alleen als de lokale opslag-API bereikbaar is (npm run dev).
  const kanToevoegen = useBoekenApi() === true

  return (
    <div className="min-h-screen">
      <nav className="bg-ink text-cream px-6 py-4 flex items-center gap-6">
        <Link to="/" className="font-serif text-lg font-semibold">
          Mijn Bibliotheek
        </Link>
        <Link to="/" className="hover:text-gold transition">Home</Link>
        <Link to="/boeken" className="hover:text-gold transition">Alle boeken</Link>
        {kanToevoegen && (
          <Link to="/toevoegen" className="ml-auto px-3 py-1.5 rounded-md bg-gold text-ink text-sm font-medium hover:opacity-90 transition">
            + Boek toevoegen
          </Link>
        )}
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/boeken" element={<BookList />} />
          <Route path="/boeken/:id" element={<BookDetail />} />
          <Route path="/toevoegen" element={<NieuwBoek />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
