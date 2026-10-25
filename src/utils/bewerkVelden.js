// Beschrijft welke velden het bewerkformulier toont en hoe we zien wat de gebruiker heeft gewijzigd.
// Een veld toevoegen (bijvoorbeeld later een cover of genre) = hier één regel erbij, en aan de kant van de
// server één regel in BEWERKBARE_VELDEN in server/boek-api.js. Het formulier zelf (BoekBewerken.jsx) tekent
// de velden uit deze lijst.
//
// Per veld:
//   begin(boek)      de waarde zoals het formulier hem toont (tekst voor invoervelden)
//   origineel(boek)  dezelfde waarde in de vorm waarin hij is opgeslagen; de server vergelijkt die met wat hij
//                    nu op schijf heeft, zodat hij merkt dat het boek intussen elders is veranderd
//   soort            hoe het veld getekend wordt (zie BoekBewerken.jsx)

// Bij een boek waarvan het id een ISBN-13 is, ís het ISBN het id: dat kan niet veranderen.
export const isIsbnVastgelegd = (boek) => /^\d{13}$/.test(boek.id)

export const goodreadsLink = (goodreadsId) => `https://www.goodreads.com/book/show/${goodreadsId}`

export const BEWERK_VELDEN = [
  { sleutel: 'titel', label: 'Titel *', soort: 'tekst', begin: (b) => b.titel ?? '', origineel: (b) => b.titel ?? null },
  { sleutel: 'auteur', label: 'Auteur', soort: 'tekst', begin: (b) => b.auteur ?? '', origineel: (b) => b.auteur ?? null },
  {
    sleutel: 'isbn', label: 'ISBN', soort: 'tekst', hint: 'ISBN-10 of ISBN-13, met of zonder streepjes.',
    begin: (b) => b.isbn ?? '', origineel: (b) => b.isbn ?? null,
    vast: isIsbnVastgelegd, vastHint: 'Het ISBN is tegelijk het id van dit boek en kan niet worden gewijzigd.',
  },
  {
    sleutel: 'goodreads', label: 'Goodreads-link', soort: 'tekst', hint: 'Link naar de boekpagina op Goodreads. Leeg laten haalt de link weg.',
    begin: (b) => (b.goodreads_id ? goodreadsLink(b.goodreads_id) : ''), origineel: (b) => b.goodreads_id ?? null,
  },
  { sleutel: 'datum_gelezen', label: 'Leesdatum', soort: 'datum', hint: 'Wis de datum als je hem niet weet.', begin: (b) => b.datum_gelezen ?? '', origineel: (b) => b.datum_gelezen ?? null },
  { sleutel: 'paginas', label: 'Aantal pagina\'s', soort: 'getal', begin: (b) => (b.paginas != null ? String(b.paginas) : ''), origineel: (b) => b.paginas ?? null },
  {
    sleutel: 'jaar_origineel', label: 'Jaar van eerste uitgave', soort: 'getal', hint: 'Voor jaren voor Christus: een min-teken, bijvoorbeeld -800.',
    begin: (b) => (b.jaar_origineel != null ? String(b.jaar_origineel) : ''), origineel: (b) => b.jaar_origineel ?? null,
  },
  { sleutel: 'score', label: 'Beoordeling', soort: 'sterren', begin: (b) => b.beoordeling?.score ?? null, origineel: (b) => b.beoordeling?.score ?? null },
  {
    sleutel: 'favoriet', label: '♥ Favoriet', soort: 'schakelaar', hint: 'Een favoriet heeft ook een beoordeling (sterren) nodig.',
    begin: (b) => b.beoordeling?.favoriet ?? false, origineel: (b) => b.beoordeling?.favoriet ?? false,
  },
  {
    sleutel: 'notitie', label: 'Persoonlijke opmerkingen', soort: 'tekstvak', hint: 'Wordt samen met je beoordeling opgeslagen.',
    begin: (b) => b.beoordeling?.notitie ?? '', origineel: (b) => b.beoordeling?.notitie ?? null,
  },
]

// De beginwaarden voor het formulier, uit het boek zoals het nu in de collectie staat.
export function beginwaarden(boek) {
  return Object.fromEntries(BEWERK_VELDEN.map((veld) => [veld.sleutel, veld.begin(boek)]))
}

// Vergelijkt het formulier met het boek en geeft terug wat er naar de server moet:
//   wijzigingen  alleen de velden die echt anders zijn (de rest blijft op schijf onaangeroerd)
//   origineel    van die velden de waarde zoals opgeslagen toen we het boek laadden
export function maakWijziging(boek, waarden) {
  const wijzigingen = {}
  const origineel = {}
  for (const veld of BEWERK_VELDEN) {
    if (veld.vast?.(boek)) continue
    if (waarden[veld.sleutel] !== veld.begin(boek)) {
      wijzigingen[veld.sleutel] = waarden[veld.sleutel]
      origineel[veld.sleutel] = veld.origineel(boek)
    }
  }
  return { wijzigingen, origineel }
}
