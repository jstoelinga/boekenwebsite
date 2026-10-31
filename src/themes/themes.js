export const DEFAULT_THEME_ID = 'cozy-library'
export const THEME_STORAGE_KEY = 'boekenwebsite-theme'

export const themes = [
  {
    id: 'cozy-library',
    name: 'Cozy Library',
    description: 'Warme tinten, zacht papier en de rust van een vertrouwde leeshoek.',
    tokens: {
      cream: '246 241 231',
      ink: '43 38 33',
      moss: '63 91 69',
      gold: '184 134 43',
      surface: '255 255 255',
      muted: '105 98 89',
    },
  },
  {
    id: 'botanical',
    name: 'Botanical',
    description: 'Fris bladgroen en natuurlijke kleuren voor een bibliotheek vol leven.',
    tokens: {
      cream: '239 244 232',
      ink: '38 57 43',
      moss: '70 111 74',
      gold: '185 126 78',
      surface: '250 252 245',
      muted: '86 108 88',
    },
  },
  {
    id: 'dark-academia',
    name: 'Dark Academia',
    description: 'Diep inkt, gedempt groen en goud voor lange avonden tussen de boeken.',
    tokens: {
      cream: '34 31 34',
      ink: '236 225 207',
      moss: '136 157 128',
      gold: '210 171 106',
      surface: '48 43 48',
      muted: '185 174 158',
    },
  },
  {
    id: 'whimsical',
    name: 'Whimsical',
    description: 'Lila, zachtroze en een vleugje magie voor een speelse leesplek.',
    tokens: {
      cream: '250 239 248',
      ink: '61 46 71',
      moss: '121 84 162',
      gold: '211 116 142',
      surface: '255 250 255',
      muted: '119 98 132',
    },
  },
]

export function getTheme(themeId) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0]
}
