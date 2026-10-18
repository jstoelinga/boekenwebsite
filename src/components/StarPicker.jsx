// Kies 1 t/m 5 sterren. Nogmaals op dezelfde ster klikken haalt de beoordeling weer weg.
function StarPicker({ value, onChange }) {
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Beoordeling">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} ${n === 1 ? 'ster' : 'sterren'}`}
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? null : n)}
          className={`text-3xl leading-none transition ${value && n <= value ? 'text-gold' : 'text-ink/20 hover:text-gold/60'}`}
        >
          ★
        </button>
      ))}
      <span className="ml-3 text-sm text-ink/50">{value ? `${value} van 5` : 'geen beoordeling'}</span>
    </div>
  )
}

export default StarPicker
