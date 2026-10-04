// Bouwt, per boek, een rij kandidaat-URL's voor de cover, van beste naar slechtste optie.
// CoverImage.jsx probeert ze op volgorde en springt naar de volgende zodra er eentje niet laadt.
//
// Volgorde voorkant: 1) jouw eigen bestand in public/covers/, 2) cover_url uit gelezen.json,
// 3) Open Library op basis van ISBN, 4) niets meer -> CoverImage toont een placeholder.
const BASE = import.meta.env.BASE_URL

export function voorCoverKandidaten(boek, covers) {
  const kandidaten = []
  if (covers[boek.id]?.voor) kandidaten.push(`${BASE}covers/${boek.id}-voor.jpg`)
  if (boek.cover_url) kandidaten.push(boek.cover_url)
  if (boek.isbn) {
    // default=false laat Open Library een echte 404 geven in plaats van een lege
    // placeholder-afbeelding, zodat CoverImage correct kan doorschakelen.
    kandidaten.push(`https://covers.openlibrary.org/b/isbn/${boek.isbn}-L.jpg?default=false`)
  }
  return kandidaten
}

// Achterkant heeft geen automatische bron: alleen tonen als jij zelf een bestand hebt aangeleverd.
export function achterCoverKandidaten(boek, covers) {
  return covers[boek.id]?.achter ? [`${BASE}covers/${boek.id}-achter.jpg`] : []
}
