import { useCallback, useEffect, useReducer } from 'react'
import { titleCardResource } from '@/api/titleCards'
import type { PopularMediaItem } from '@/api/tmdb'
import { titleKey, type TitleRef } from '@/lib/library'

export type TitleCard = {
  ref: TitleRef
  /** `undefined` while loading, or when the title could not be loaded (`failed`). */
  item: PopularMediaItem | undefined
  failed: boolean
}

/**
 * Loads the card data of saved titles from TMDB. All requests start together, cards appear as
 * they arrive, and the order of `refs` is kept, so the grid does not jump around while loading.
 */
export function useTitleCards(refs: TitleRef[]) {
  const [, rerender] = useReducer((count: number) => count + 1, 0)
  const signature = refs.map(titleKey).join(',')

  useEffect(() => {
    const unsubscribe = refs.map((ref) => {
      const resource = titleCardResource(ref)
      const stop = resource.subscribe(rerender)
      void resource.get().catch(() => {})
      return stop
    })

    return () => unsubscribe.forEach((stop) => stop())
    // `signature` is the identity of `refs`: a new array with the same titles changes nothing.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  const cards: TitleCard[] = refs.map((ref) => {
    const state = titleCardResource(ref).getState()
    return { ref, item: state.data, failed: state.data === undefined && state.status === 'error' }
  })

  const retry = useCallback(() => {
    refs.forEach((ref) => {
      const resource = titleCardResource(ref)
      if (resource.getState().status === 'error') void resource.get().catch(() => {})
    })
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  return { cards, hasFailed: cards.some((card) => card.failed), retry }
}
