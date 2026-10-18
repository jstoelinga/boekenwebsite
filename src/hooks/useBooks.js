import { useSyncExternalStore } from 'react'
import gelezenData from '../data/gelezen.json'
import beoordelingenData from '../data/beoordelingen.json'
import coversData from '../data/covers.json'
import { voorCoverKandidaten, achterCoverKandidaten } from '../utils/covers.js'

function maakBoek(boek, beoordeling, covers) {
  return {
    ...boek,
    beoordeling,
    coverVoor: voorCoverKandidaten(boek, covers),
    coverAchter: achterCoverKandidaten(boek, covers),
  }
}

// Eén keer samenvoegen bij het laden van de module, niet bij elke render.
// Een Map voor de koppeling (in plaats van .find() per boek) houdt dit ook bij
// 2000+ boeken snel: opzoeken is dan O(1) in plaats van O(n) per boek.
const beoordelingPerId = new Map(beoordelingenData.map((r) => [r.id, r]))
const startBoeken = gelezenData.map((boek) => maakBoek(boek, beoordelingPerId.get(boek.id) ?? null, coversData))

// De huidige collectie. Wordt nooit aangepast, alleen vervangen door een nieuw object,
// zodat React (useMemo in BookList, enz.) ziet dat er iets veranderd is.
let staat = {
  covers: coversData,
  boeken: startBoeken,
  boekPerId: new Map(startBoeken.map((b) => [b.id, b])),
}
const luisteraars = new Set()
const abonneer = (luisteraar) => {
  luisteraars.add(luisteraar)
  return () => luisteraars.delete(luisteraar)
}
const leesStaat = () => staat

// Zelfde functies als altijd; ze reageren nu ook op voegBoekToe().
export function useBooks() {
  return useSyncExternalStore(abonneer, leesStaat, leesStaat).boeken
}

export function useBook(id) {
  return useSyncExternalStore(abonneer, leesStaat, leesStaat).boekPerId.get(id) ?? null
}

// Zet een zojuist opgeslagen boek direct in de collectie op het scherm. Het boek staat dan al in
// gelezen.json (opgeslagen door server/boek-api.js); dit zorgt er alleen voor dat je het meteen ziet,
// zonder de pagina te herladen. Na een herstart komt het boek gewoon uit gelezen.json.
export function voegBoekToe({ boek, beoordeling = null, covers = null }) {
  if (staat.boekPerId.has(boek.id)) return
  const nieuweCovers = covers ? { ...staat.covers, [boek.id]: covers } : staat.covers
  const nieuwBoek = maakBoek(boek, beoordeling, nieuweCovers)
  staat = {
    covers: nieuweCovers,
    boeken: [nieuwBoek, ...staat.boeken],
    boekPerId: new Map(staat.boekPerId).set(boek.id, nieuwBoek),
  }
  luisteraars.forEach((luisteraar) => luisteraar())
}
