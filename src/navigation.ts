import type { MediaKind } from '@/api/tmdb'

export const navItems = [
  { label: 'Home', href: '/' },
  { label: 'For You', href: '/recommendations' },
  { label: 'Search', href: '/search' },
] as const

/** Route of a title's page: `/movie/<id>` or `/series/<id>`. */
export function titlePath(kind: MediaKind, id: number): string {
  return `/${kind}/${id}`
}