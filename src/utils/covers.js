const BASE = import.meta.env.BASE_URL

export function voorCoverKandidaten(boek, covers) {
  const kandidaten = []

  // 1. Eigen lokale cover
  if (covers[boek.id]?.voor) {
    kandidaten.push(`${BASE}covers/${boek.id}-voor.jpg`)
  }

  // 2. Cover URL uit gelezen.json
  if (boek.cover_url) {
    kandidaten.push(boek.cover_url)
  }

  // 3. Open Library via ISBN
  if (boek.isbn) {
    kandidaten.push(
      `https://covers.openlibrary.org/b/isbn/${boek.isbn}-L.jpg?default=false`
    )
  }

  // 4. Eigen placeholder
  kandidaten.push(`${BASE}covers/no-cover.jpg`)

  return kandidaten
}

// Achterkant heeft geen automatische bron:
// alleen tonen als jij zelf een bestand hebt aangeleverd.
export function achterCoverKandidaten(boek, covers) {
  return covers[boek.id]?.achter
    ? [`${BASE}covers/${boek.id}-achter.jpg`]
    : []
}