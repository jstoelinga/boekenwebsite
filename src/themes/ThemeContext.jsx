import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { DEFAULT_THEME_ID, getTheme, THEME_STORAGE_KEY } from './themes.js'

const ThemeContext = createContext(null)

function readSavedTheme() {
  if (typeof window === 'undefined') return DEFAULT_THEME_ID

  try {
    const savedId = window.localStorage.getItem(THEME_STORAGE_KEY)
    return getTheme(savedId).id
  } catch {
    return DEFAULT_THEME_ID
  }
}

function applyThemeTokens(theme) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  Object.entries(theme.tokens).forEach(([name, value]) => {
    root.style.setProperty(`--theme-${name}`, value)
  })
}

export function ThemeProvider({ children }) {
  const [selectedThemeId, setSelectedThemeId] = useState(readSavedTheme)
  const [previewThemeId, setPreviewThemeId] = useState(null)
  const [storageError, setStorageError] = useState('')
  const activeTheme = getTheme(previewThemeId ?? selectedThemeId)

  useLayoutEffect(() => {
    applyThemeTokens(activeTheme)
  }, [activeTheme])

  const previewTheme = useCallback((themeId) => {
    setStorageError('')
    setPreviewThemeId(getTheme(themeId).id)
  }, [])

  const cancelPreview = useCallback(() => {
    setPreviewThemeId(null)
    setStorageError('')
  }, [])

  const saveTheme = useCallback((themeId) => {
    const theme = getTheme(themeId)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme.id)
      setSelectedThemeId(theme.id)
      setPreviewThemeId(null)
      setStorageError('')
      return true
    } catch {
      setStorageError('Je browser kon de themakeuze niet bewaren. Controleer de opslaginstellingen en probeer opnieuw.')
      return false
    }
  }, [])

  const value = useMemo(() => ({
    activeTheme,
    selectedThemeId,
    previewThemeId,
    storageError,
    previewTheme,
    cancelPreview,
    saveTheme,
  }), [activeTheme, selectedThemeId, previewThemeId, storageError, previewTheme, cancelPreview, saveTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme moet binnen ThemeProvider worden gebruikt.')
  return context
}
