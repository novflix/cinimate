import MediaCard from '@/components/MediaCard/MediaCard'
import type { PopularMediaItem } from '@/api/tmdb'
import './MediaGrid.css'

type MediaGridProps = {
  label: string
  items: PopularMediaItem[]
  variant?: 'default' | 'upcoming'
}

function MediaGrid({ label, items, variant = 'default' }: MediaGridProps) {
  return (
    <ul className="media-grid" aria-label={label}>
      {items.map((item) => (
        <li className="media-grid__item" key={`${item.kind}-${item.id}`}>
          <MediaCard item={item} variant={variant} />
        </li>
      ))}
    </ul>
  )
}

export default MediaGrid