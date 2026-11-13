export const categories = [
  { id: 'popular', label: 'Popular' },
  { id: 'now-playing', label: 'Now in theaters' },
  { id: 'coming-soon', label: 'Coming Soon' },
  { id: 'classic', label: 'Classic' },
  { id: 'new-releases', label: `New ${new Date().getFullYear()}` },
  { id: 'seasonal', label: 'Seasonal' },
] as const

export type CategoryId = (typeof categories)[number]['id']
