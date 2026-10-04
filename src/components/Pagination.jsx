function Pagination({ pagina, totaalPaginas, onChange }) {
  if (totaalPaginas <= 1) return null

  const knopCls = 'px-3 py-1.5 border border-ink/20 rounded-md text-sm disabled:opacity-30 disabled:cursor-not-allowed hover:border-gold transition'

  return (
    <div className="flex items-center justify-center gap-3 pt-4">
      <button className={knopCls} disabled={pagina <= 1} onClick={() => onChange(pagina - 1)}>
        ← Vorige
      </button>
      <span className="text-sm text-ink/60">
        Pagina {pagina} van {totaalPaginas}
      </span>
      <button className={knopCls} disabled={pagina >= totaalPaginas} onClick={() => onChange(pagina + 1)}>
        Volgende →
      </button>
    </div>
  )
}

export default Pagination
