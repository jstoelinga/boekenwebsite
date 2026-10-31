import { useTheme } from '../themes/ThemeContext.jsx'
import { themes } from '../themes/themes.js'

function ThemePreview({ theme }) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-ink/10 p-3"
      style={{ backgroundColor: `rgb(${theme.tokens.cream})`, color: `rgb(${theme.tokens.ink})` }}
      aria-label={`Kleurvoorbeeld van ${theme.name}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-serif text-xs font-semibold">Mijn bibliotheek</span>
        <span className="rounded-full px-2 py-1 text-[9px]" style={{ backgroundColor: `rgb(${theme.tokens.moss})`, color: `rgb(${theme.tokens.surface})` }}>
          Vandaag
        </span>
      </div>
      <div className="mt-3 flex h-16 items-end gap-1.5 rounded-md p-2" style={{ backgroundColor: `rgb(${theme.tokens.surface})` }}>
        {[0, 1, 2, 3, 4].map((book, index) => (
          <span
            key={book}
            className="block rounded-t-sm"
            style={{
              backgroundColor: index % 2 ? `rgb(${theme.tokens.gold})` : `rgb(${theme.tokens.moss})`,
              height: `${34 + (index % 3) * 9}px`,
              width: '13%',
            }}
          />
        ))}
        <span className="ml-auto self-start text-[9px]" style={{ color: `rgb(${theme.tokens.muted})` }}>Mijn leesplank</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {['4 gelezen', '2 favorieten'].map((label) => (
          <span key={label} className="rounded-md px-2 py-1.5 text-[9px]" style={{ backgroundColor: `rgb(${theme.tokens.surface})` }}>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

function ThemePicker() {
  const {
    activeTheme,
    selectedThemeId,
    previewThemeId,
    storageError,
    previewTheme,
    cancelPreview,
    saveTheme,
  } = useTheme()

  return (
    <div className="space-y-7">
      <header className="max-w-2xl space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-moss">Jouw leesplek</p>
        <h1 className="font-serif text-3xl font-bold">Kies een thema</h1>
        <p className="text-ink/70">
          Geef je bibliotheek een eigen sfeer. Bekijk eerst een voorbeeld; je boeken en covers blijven precies zoals ze zijn.
        </p>
      </header>

      {previewThemeId && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gold/40 bg-gold/10 px-4 py-3" aria-live="polite">
          <p className="text-sm">
            Voorbeeld actief: <strong>{activeTheme.name}</strong>. Alleen jij ziet deze tijdelijke preview.
          </p>
          <button type="button" onClick={cancelPreview} className="rounded-md border border-ink/20 bg-white px-3 py-1.5 text-sm font-medium hover:border-gold">
            Preview annuleren
          </button>
        </section>
      )}

      {storageError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{storageError}</p>}

      <section className="grid gap-5 sm:grid-cols-2" aria-label="Beschikbare thema's">
        {themes.map((theme) => {
          const isActive = activeTheme.id === theme.id
          const isSaved = selectedThemeId === theme.id
          const isPreview = previewThemeId === theme.id

          return (
            <article
              key={theme.id}
              className={`space-y-4 rounded-xl border bg-white p-4 shadow-sm transition ${isActive ? 'border-moss ring-2 ring-moss/20' : 'border-ink/10 hover:border-gold/60'}`}
              aria-current={isActive ? 'true' : undefined}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-serif text-xl font-semibold">{theme.name}</h2>
                  <p className="mt-1 text-sm text-ink/70">{theme.description}</p>
                </div>
                {isActive && (
                  <span className="shrink-0 rounded-full bg-moss/10 px-2.5 py-1 text-xs font-semibold text-moss">
                    {isPreview ? 'Preview' : 'Actief'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2" aria-label="Themakleuren">
                {['cream', 'surface', 'moss', 'gold', 'ink'].map((token) => (
                  <span
                    key={token}
                    className="h-6 w-6 rounded-full border border-ink/10"
                    style={{ backgroundColor: `rgb(${theme.tokens[token]})` }}
                    title={token}
                  />
                ))}
              </div>

              <ThemePreview theme={theme} />

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => previewTheme(theme.id)}
                  disabled={isPreview}
                  className="rounded-md border border-ink/20 bg-white px-3 py-2 text-sm font-medium transition hover:border-gold disabled:cursor-default disabled:opacity-60"
                >
                  {isPreview ? 'Voorbeeld actief' : 'Voorbeeld bekijken'}
                </button>
                <button
                  type="button"
                  onClick={() => saveTheme(theme.id)}
                  disabled={isSaved && !previewThemeId}
                  className="rounded-md bg-moss px-3 py-2 text-sm font-medium text-cream transition hover:opacity-90 disabled:cursor-default disabled:opacity-60"
                >
                  {isSaved && !previewThemeId ? 'Toegepast' : 'Thema toepassen'}
                </button>
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

export default ThemePicker
