import { useEffect, useState } from 'react'
import { haalApiStatus } from '../api/boekenApi.js'

let statusBelofte = null // één keer opvragen, ook als meerdere componenten het willen weten

// null = nog aan het controleren, true = lokale API beschikbaar, false = niet beschikbaar
export function useBoekenApi() {
  const [beschikbaar, setBeschikbaar] = useState(null)
  useEffect(() => {
    let actief = true
    statusBelofte ??= haalApiStatus()
    statusBelofte.then((ok) => {
      if (actief) setBeschikbaar(ok)
    })
    return () => {
      actief = false
    }
  }, [])
  return beschikbaar
}
