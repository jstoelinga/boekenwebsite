import gelezenData from '../data/gelezen.json'
import beoordelingenData from '../data/beoordelingen.json'
import coversData from '../data/covers.json'
import { voorCoverKandidaten, achterCoverKandidaten } from '../utils/covers.js'

// Eén keer samenvoegen bij het laden van de module, niet bij elke render.
// Een Map voor de koppeling (in plaats van .find() per boek) houdt dit ook bij
// 2000+ boeken snel: opzoeken is dan O(1) in plaats van O(n) per boek.
const beoordelingPerId = new Map(beoordelingenData.map((r) => [r.id, r]))

const boeken = gelezenData.map((boek) => ({
  ...boek,
  beoordeling: beoordelingPerId.get(boek.id) ?? null,
  coverVoor: voorCoverKandidaten(boek, coversData),
  coverAchter: achterCoverKandidaten(boek, coversData),
}))

// Zelfde idee voor het opzoeken van één boek op de detailpagina.
const boekPerId = new Map(boeken.map((b) => [b.id, b]))

export function useBooks() {
  return boeken
}

export function useBook(id) {
  return boekPerId.get(id) ?? null
}
