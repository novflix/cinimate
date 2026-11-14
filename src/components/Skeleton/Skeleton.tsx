import './Skeleton.css'

type SkeletonProps = {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <span className={`skeleton${className ? ` ${className}` : ''}`} aria-hidden="true" />
}

export function MediaCardSkeleton() {
  return (
    <div className="media-card-skeleton" aria-hidden="true">
      <Skeleton className="media-card-skeleton__poster" />
      <Skeleton className="media-card-skeleton__title" />
      <Skeleton className="media-card-skeleton__meta" />
    </div>
  )
}

type MediaRailSkeletonProps = {
  count?: number
  showHeader?: boolean
}

/** Mirrors `MediaRail` closely enough that swapping in real cards causes no layout shift. */
export function MediaRailSkeleton({ count = 7, showHeader = true }: MediaRailSkeletonProps) {
  return (
    <section className="media-rail media-rail--skeleton" aria-hidden="true">
      {showHeader && (
        <div className="media-rail__header">
          <Skeleton className="media-rail-skeleton__heading" />
        </div>
      )}

      <div className="media-rail__track media-rail-skeleton__track">
        {Array.from({ length: count }, (_, index) => (
          <div className="media-rail__item" key={index}>
            <MediaCardSkeleton />
          </div>
        ))}
      </div>
    </section>
  )
}

type MediaGridSkeletonProps = {
  count?: number
}

/** Mirrors `MediaGrid` so a grid of cards fades in without moving the page. */
export function MediaGridSkeleton({ count = 12 }: MediaGridSkeletonProps) {
  return (
    <div className="media-grid media-grid--skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="media-grid__item" key={index}>
          <MediaCardSkeleton />
        </div>
      ))}
    </div>
  )
}
