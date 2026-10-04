# Mijn Boekenbibliotheek

Een persoonlijke website om gelezen boeken bij te houden en te presenteren, gebouwd
als leerproject voor React, Git/GitHub en (later) een AI-agent die nieuwe boeken
mag voorstellen.

## Wat dit is

Een statische React-website (geen server, geen database) die zijn gegevens haalt
uit één JSON-bestand: `src/data/books.json`. De site zelf leest dat bestand en
toont het als homepage, overzicht met zoek/filter, en detailpagina's.

## Belangrijkste bestanden

| Bestand | Waarvoor |
|---|---|
| `src/data/books.json` | **De databron.** Alle boeken staan hier. Dit is het enige bestand dat je (of later de AI-agent) meestal aanpast. |
| `src/hooks/useBooks.js` | Leest `books.json` in en zoekt boeken op `id` op. |
| `src/pages/Home.jsx` | Homepage: recent gelezen + favorieten. |
| `src/pages/BookList.jsx` | Overzicht van alle boeken, met zoekbalk en filters. |
| `src/pages/BookDetail.jsx` | Detailpagina van één boek. |
| `src/components/BookCard.jsx` | De "boekentegel" die overal wordt hergebruikt. |
| `vite.config.js` | Bouwconfiguratie. Bevat de `base` (repo-naam) die nodig is voor GitHub Pages. |
| `.github/workflows/deploy.yml` | Publiceert de site automatisch naar GitHub Pages bij elke push naar `main`. |
| `tailwind.config.js` | Kleuren en lettertypes van de site. |

Zie **BEHEER.md** voor hoe je dagelijks met de site werkt (boeken toevoegen,
lokaal draaien, publiceren).

## Techniek

- **React** (met Vite als bouwtool — sneller en simpeler dan het oudere Create React App)
- **Tailwind CSS** voor styling
- **React Router** voor de pagina's, zonder eigen server nodig
- **JSON-bestand** als databron — geen database
- **GitHub Actions** bouwt en publiceert de site automatisch naar **GitHub Pages**

Er is bewust geen backend. Dat betekent: geen inlogsysteem, geen live
"goedkeuren"-knop op de site zelf. Wijzigingen gebeuren door `books.json` aan
te passen en te pushen naar GitHub — dat is ook precies wat de toekomstige
AI-agent zal doen.

## Datamodel per boek

```json
{
  "id": "unieke-slug-zonder-spaties",
  "titel": "",
  "auteur": "",
  "genre": "",
  "cover_url": "",
  "achterkant_url": "",
  "samenvatting": "",
  "mijn_mening": "",
  "score": 8,
  "datum_gelezen": "2026-01-15",
  "status": "gelezen | bezig | nog lezen",
  "favoriet": false,
  "goodreads_link": "",
  "auteur_link": ""
}
```

`score` en `datum_gelezen` mogen `null` zijn zolang je een boek nog niet
(volledig) gelezen hebt. `id` moet uniek zijn — dit wordt gebruikt in de URL
van de detailpagina (`/boeken/de-hobbit`) en is ook de haak waarmee een
toekomstige AI-agent een boek herkent en dubbele invoer kan voorkomen.

## Toekomstige AI-agent workflow

```
Boek gevonden
   ↓
Agent verzamelt informatie (titel, auteur, cover, samenvatting, links...)
   ↓
Agent stelt een JSON-object voor, in exact bovenstaand formaat
   ↓
Jij keurt goed of af
   ↓
books.json wordt aangepast (nieuw object toegevoegd aan de array)
   ↓
Commit + push naar GitHub
   ↓
GitHub Actions bouwt en publiceert de site automatisch
```

Omdat alle content-logica al in `useBooks.js` en de pagina's zit, hoeft een
agent alleen ooit één ding te doen: een geldig boek-object aan de array in
`books.json` toevoegen. De rest van de site werkt daar automatisch mee.

## Bewuste keuzes (en waarom)

- **Favorieten staan in `books.json`** (`"favoriet": true`) in plaats van een
  klik-knop op de site. Een knop zou alleen lokaal in je browser iets
  onthouden (via `localStorage`) en niet overal zichtbaar zijn — voor een
  persoonlijke, statische site is een JSON-veld betrouwbaarder.
- **Cover-afbeeldingen als externe URL** (bijvoorbeeld via de gratis
  [Open Library Covers API](https://openlibrary.org/dev/docs/api/covers)) in
  plaats van bestanden in de repo. Dit houdt de repo klein en maakt het
  makkelijker voor een toekomstige agent om automatisch een cover te vinden
  zonder bestanden te hoeven downloaden en beheren. Je kunt dit altijd nog
  aanvullen met lokale bestanden in `public/covers/` voor boeken waarvan je de
  afbeelding echt wilt vastzetten.
