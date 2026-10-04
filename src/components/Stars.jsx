function Stars({ score, max = 5 }) {
  return (
    <span className="text-gold tracking-tight" aria-label={`${score} van ${max} sterren`}>
      {'★'.repeat(score)}
      <span className="text-ink/20">{'★'.repeat(max - score)}</span>
    </span>
  )
}

export default Stars
