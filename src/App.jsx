import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home.jsx'
import BookList from './pages/BookList.jsx'
import BookDetail from './pages/BookDetail.jsx'

function App() {
  return (
    <div className="min-h-screen">
      <nav className="bg-ink text-cream px-6 py-4 flex items-center gap-6">
        <Link to="/" className="font-serif text-lg font-semibold">
          Mijn Bibliotheek
        </Link>
        <Link to="/" className="hover:text-gold transition">Home</Link>
        <Link to="/boeken" className="hover:text-gold transition">Alle boeken</Link>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/boeken" element={<BookList />} />
          <Route path="/boeken/:id" element={<BookDetail />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
