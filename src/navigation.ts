import type { MediaKind } from '@/api/tmdb'

/** Every page has its own path; the site root is only a redirect to the home page. */
export const homePath = '/home'

export const navItems = [
  { label: 'Home', href: homePath },
  { label: 'For You', href: '/recommendations' },
  { label: 'Search', href: '/search' },
] as const

/** Route of a title's page: `/movie/<id>` or `/series/<id>`. */
export function titlePath(kind: MediaKind, id: number): string {
  return `/${kind}/${id}`
}

/** Route of a person's page (actor, director, ...): `/person/<id>`. */
export function personPath(id: number): string {
  return `/person/${id}`
}