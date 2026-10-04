# Beheerhandleiding

Praktische stappen voor het dagelijks werken met de website.

## 1. Het project openen in VSCodium

1. Open VSCodium.
2. `File → Open Folder...` en kies de map `boekenwebsite`.
3. Open een terminal binnen VSCodium via `Terminal → New Terminal` (of
   `Ctrl+`` ` /  `Cmd+`` `). Alle commando's hieronder voer je in dit
   terminalvenster uit, in de projectmap.
4. Eenmalig, de eerste keer dat je het project opent:
   ```
   npm install
   ```
   Dit installeert alle benodigde pakketten (React, Tailwind, etc.) in een
   map `node_modules/`. Die map hoort niet in Git (staat al in `.gitignore`).

Handige VSCodium-extensies (optioneel, via het Extensions-icoon links):
- **ES7+ React/Redux snippets** — sneltoetsen voor React-code
- **Tailwind CSS IntelliSense** — autocomplete voor Tailwind-classes
- **GitLens** — overzichtelijker zien wat je in Git hebt gewijzigd

## 2. Website lokaal starten (testen op je eigen computer)

```
npm run dev
```
Dit start een lokale server, meestal op `http://localhost:5173`. Open die
link in je browser. Wijzigingen die je opslaat in `src/` verschijnen direct
(hot reload) — je hoeft niet steeds te herstarten.

Stoppen: `Ctrl+C` in de terminal.

## 3. Een boek toevoegen

1. Open `src/data/books.json`.
2. Kopieer een bestaand boek-object (de `{ ... }` van bijvoorbeeld "De Hobbit").
3. Plak het als nieuw element in de array (let op de komma's tussen objecten).
4. Pas alle velden aan. Belangrijk:
   - `id` moet uniek zijn en mag geen spaties/hoofdletters bevatten
     (bijv. `"de-naam-van-de-wind"`).
   - `status` moet exact `"gelezen"`, `"bezig"` of `"nog lezen"` zijn (kleine
     letters) — de filters zoeken op deze exacte tekst.
   - `score` en `datum_gelezen` mogen `null` zijn als je het boek nog niet
     (klaar) hebt gelezen.
5. Sla op. Bekijk het resultaat via `npm run dev` (zie stap 2).

Tip: een cover-URL vind je bijvoorbeeld via
`https://covers.openlibrary.org/b/isbn/JOUW-ISBN-L.jpg` (ISBN van het boek
invullen).

## 4. Tekst wijzigen

- **Tekst van een specifiek boek** (samenvatting, mening, score, links):
  pas het bijbehorende object aan in `src/data/books.json`.
- **Vaste teksten op de site** (bijv. "Alle boeken", "Mijn Bibliotheek"):
  die staan direct in de betreffende pagina in `src/pages/` of
  `src/App.jsx`. Zoek de tekst op (Ctrl+F / Cmd+F in VSCodium) en pas aan.
- **Kleuren/lettertype**: in `tailwind.config.js` onder `colors` en
  `fontFamily`.

## 5. Wijzigingen publiceren naar de live website

Elke keer dat je iets pusht naar de `main`-branch op GitHub, bouwt en
publiceert GitHub Actions de site automatisch — je hoeft zelf niets te
bouwen of te uploaden.

```
git add .
git commit -m "Boek toegevoegd: De naam van de wind"
git push
```

Na een paar minuten (te volgen via het "Actions"-tabblad van je repo op
GitHub) staat de nieuwe versie live.

### Eenmalige GitHub-instellingen (bij het eerste opzetten)

1. Maak een lege GitHub-repository aan, bijvoorbeeld genaamd `boekenwebsite`.
2. Zorg dat `vite.config.js` (`base:`) en `src/main.jsx` (`basename`) exact
   die repo-naam gebruiken.
3. Koppel je lokale project en push voor het eerst:
   ```
   git init
   git remote add origin https://github.com/JOUW-GEBRUIKERSNAAM/boekenwebsite.git
   git add .
   git commit -m "Eerste versie van de boekenwebsite"
   git branch -M main
   git push -u origin main
   ```
4. Ga op GitHub naar **Settings → Pages** en zet **Source** op
   **GitHub Actions**. Vanaf nu publiceert elke push naar `main` automatisch.

## 6. Snelle checklist bij problemen

- **Site laadt lokaal wel maar niet online / geen styling**: controleer of
  `base` in `vite.config.js` en `basename` in `src/main.jsx` exact je
  repo-naam zijn (inclusief schuine strepen: `/repo-naam/`).
- **Boek verschijnt niet**: controleer of `books.json` geldige JSON is (een
  ontbrekende komma breekt het hele bestand). VSCodium onderstreept fouten
  meestal rood.
- **`npm run dev` geeft een foutmelding**: run `npm install` opnieuw.
