function SearchBar({ value, onChange }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Zoek op titel of auteur..."
      className="w-full px-4 py-2 border border-ink/20 rounded-md focus:outline-none focus:border-gold"
    />
  )
}

export default SearchBar
