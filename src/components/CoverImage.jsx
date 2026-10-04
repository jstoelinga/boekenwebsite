import { useState } from 'react'

// Toont candidates[0]; als die niet laadt (onError), probeert hij candidates[1], enzovoort.
// Zijn alle kandidaten op (of was de lijst leeg), dan toont hij een nette placeholder
// in plaats van een kapot-plaatje-icoon.
function CoverImage({ candidates, alt, className }) {
  const [index, setIndex] = useState(0)
  const src = candidates[index]

  if (!src) {
    return (
      <div className={`${className} flex items-center justify-center bg-ink/5 text-ink/30 text-xs text-center p-2`}>
        Geen cover
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setIndex((i) => i + 1)}
    />
  )
}

export default CoverImage
