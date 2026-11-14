import { profileUrl } from '@/api/tmdb'
import type { TitlePerson } from '@/api/details'
import './PersonCard.css'

type PersonCardProps = {
  person: TitlePerson
}

/** Item class for `MediaRail`, so people cards get their own (narrower) width. */
export const personItemClass = 'person-item'

function PersonCard({ person }: PersonCardProps) {
  return (
    <figure className="person-card">
      <div className="person-card__photo">
        {person.photo ? (
          <img
            src={profileUrl(person.photo, 'w185')}
            srcSet={`${profileUrl(person.photo, 'w185')} 185w, ${profileUrl(
              person.photo,
              'h632',
            )} 421w`}
            sizes="(max-width: 768px) 100px, 150px"
            alt=""
            loading="lazy"
            decoding="async"
          />
        ) : null}
      </div>
      <figcaption className="person-card__caption">
        <span className="person-card__name">{person.name}</span>
        {person.role && <span className="person-card__role">{person.role}</span>}
      </figcaption>
    </figure>
  )
}

export default PersonCard