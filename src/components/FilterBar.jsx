const selectCls = 'border border-ink/20 rounded-md px-3 py-2 bg-white text-sm'

function FilterBar({ genres, jaren, filters, onChange }) {
  // Kleine helper: past één veld van de filters aan en geeft de rest ongemoeid.
  const zet = (veld) => (waarde) => onChange({ ...filters, [veld]: waarde })

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <select value={filters.genre} onChange={(e) => zet('genre')(e.target.value)} className={selectCls}>
        <option value="">Alle genres</option>
        {genres.map((g) => (
          <option key={g} value={g}>{g}</option>
        ))}
      </select>

      <select value={filters.jaar} onChange={(e) => zet('jaar')(e.target.value)} className={selectCls}>
        <option value="">Alle jaren</option>
        {jaren.map((j) => (
          <option key={j} value={j}>{j}</option>
        ))}
      </select>

      <select value={filters.beoordelingFilter} onChange={(e) => zet('beoordelingFilter')(e.target.value)} className={selectCls}>
        <option value="alle">Beoordeeld en onbeoordeeld</option>
        <option value="beoordeeld">Alleen beoordeeld</option>
        <option value="onbeoordeeld">Alleen onbeoordeeld</option>
      </select>

      <select value={filters.minScore} onChange={(e) => zet('minScore')(Number(e.target.value))} className={selectCls}>
        <option value={0}>Elke score</option>
        {[5, 4, 3, 2, 1].map((s) => (
          <option key={s} value={s}>{s}+ sterren</option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm px-1 select-none">
        <input
          type="checkbox"
          checked={filters.alleenFavorieten}
          onChange={(e) => zet('alleenFavorieten')(e.target.checked)}
        />
        Alleen favorieten
      </label>

      <select
        value={filters.sortering}
        onChange={(e) => zet('sortering')(e.target.value)}
        className={`${selectCls} sm:ml-auto`}
      >
        <option value="datum-nieuw">Recent gelezen eerst</option>
        <option value="datum-oud">Langst geleden gelezen eerst</option>
        <option value="titel">Titel (A-Z)</option>
        <option value="score">Mijn score (hoog naar laag)</option>
      </select>
    </div>
  )
}

export default FilterBar
