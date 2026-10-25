// Praat met de lokale boeken-API (server/boek-api.js). Die bestaat alleen tijdens `npm run dev`.
const BASIS = import.meta.env.BASE_URL

// Is de API er? Alleen "ja" als het antwoord echt JSON is met boekenApi: true. Een statische site
// (GitHub Pages) of `vite preview` kan voor onbekende paden gewoon index.html teruggeven met status 200;
// dat mag nooit voor "ja" doorgaan.
export async function haalApiStatus() {
  try {
    const antwoord = await fetch(`${BASIS}api/status`, { headers: { Accept: 'application/json' } })
    if (!antwoord.ok) return false
    if (!(antwoord.headers.get('content-type') ?? '').includes('application/json')) return false
    const data = await antwoord.json()
    return data?.boekenApi === true
  } catch {
    return false
  }
}

// Wijzigt een bestaand boek via PATCH /api/boeken/<id>. Stuurt alleen de gewijzigde velden (wijzigingen) en hun
// oorspronkelijke waarden (origineel), zie server/boek-api.js. Zelfde antwoordvorm als slaBoekOp.
export async function wijzigBoek(id, wijzigingen, origineel, cover = null) {
  try {
    const invoer = { wijzigingen, origineel }
    if (cover) invoer.cover = cover
    const antwoord = await fetch(`${BASIS}api/boeken/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoer),
    })
    const data = await antwoord.json().catch(() => null)
    if (antwoord.ok && data?.ok) return { ok: true, data }
    return { ok: false, fout: data?.fout ? data : { fout: `Onverwacht antwoord van de server (status ${antwoord.status}).` } }
  } catch {
    return { ok: false, fout: { fout: 'Kon de lokale server niet bereiken. Draait "npm run dev" nog, en gebruik je http://localhost?' } }
  }
}

// Geeft { ok: true, data } of { ok: false, fout: { fout, veld?, soort?, bestaand?, kanForceren? } }.
export async function slaBoekOp(invoer) {
  try {
    const antwoord = await fetch(`${BASIS}api/boeken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invoer),
    })
    const data = await antwoord.json().catch(() => null)
    if (antwoord.ok && data?.ok) return { ok: true, data }
    return { ok: false, fout: data?.fout ? data : { fout: `Onverwacht antwoord van de server (status ${antwoord.status}).` } }
  } catch {
    return { ok: false, fout: { fout: 'Kon de lokale server niet bereiken. Draait "npm run dev" nog, en gebruik je http://localhost?' } }
  }
}
