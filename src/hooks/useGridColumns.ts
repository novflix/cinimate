import { useLayoutEffect, useState, type RefObject } from 'react'

/**
 * Number of equal-width card columns that fit in `ref`. Layout effects run before the first
 * paint, so a card grid never renders at a wrong width and then reflows.
 */
export function useGridColumns(
  ref: RefObject<HTMLElement | null>,
  minCardWidth: number,
  gap: number,
  minColumns = 2,
  maxColumns = Number.POSITIVE_INFINITY,
): number {
  const [columns, setColumns] = useState(0)

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return

    const update = () => {
      const width = node.clientWidth
      const fitted = Math.floor((width + gap) / (minCardWidth + gap))
      const next = Math.min(maxColumns, Math.max(minColumns, fitted))
      setColumns((previous) => (previous === next ? previous : next))
    }

    update()

    const observer = new ResizeObserver(update)
    observer.observe(node)

    return () => observer.disconnect()
  }, [ref, minCardWidth, gap, minColumns, maxColumns])

  return columns
}
