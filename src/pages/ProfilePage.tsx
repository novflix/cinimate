import { useState } from 'react'
import { Logout2Icon } from '@solar-icons/react/linear/logout-2'
import { ShuffleIcon } from '@solar-icons/react/linear/shuffle'
import { Link, useNavigate } from 'react-router-dom'
import FeedStatus from '@/components/FeedStatus/FeedStatus'
import MediaCard from '@/components/MediaCard/MediaCard'
import ProfileHeader from '@/components/ProfileHeader/ProfileHeader'
import ProfileTabs, { type ProfileTab } from '@/components/ProfileTabs/ProfileTabs'
import { MediaCardSkeleton } from '@/components/Skeleton/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useLibrary } from '@/hooks/useLibrary'
import { useTitleCards } from '@/hooks/useTitleCards'
import { titleKey, type TitleRef } from '@/lib/library'
import { homePath } from '@/navigation'
import './ProfilePage.css'

type TabId = 'watchlist' | 'watched'

const emptyMessages: Record<TabId, { title: string; hint: string }> = {
  watchlist: {
    title: 'Your watchlist is empty',
    hint: 'Tap the bookmark on any movie or series to save it for later.',
  },
  watched: {
    title: 'Nothing watched yet',
    hint: 'Tap the eye on a title you have seen and it will show up here.',
  },
}

function formatJoined(value: string | null): string | undefined {
  if (!value) return undefined

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined

  return `Joined ${date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
}

/** The saved ids are turned into cards by TMDB; a skeleton holds each place until its card is in. */
function ProfileGrid({ titles, label }: { titles: TitleRef[]; label: string }) {
  const { cards, hasFailed, retry } = useTitleCards(titles)

  return (
    <>
      <ul className="profile-grid" aria-label={label}>
        {cards
          .filter((card) => !card.failed)
          .map(({ ref, item }) => (
            <li className="profile-grid__item" key={titleKey(ref)}>
              {item ? <MediaCard item={item} showActions={false} /> : <MediaCardSkeleton />}
            </li>
          ))}
      </ul>

      {hasFailed && <FeedStatus message="Some titles could not be loaded." onRetry={retry} />}
    </>
  )
}

const SKELETON_COUNT = 9

function ProfileGridSkeleton() {
  return (
    <ul className="profile-grid" aria-hidden="true">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <li className="profile-grid__item" key={index}>
          <MediaCardSkeleton />
        </li>
      ))}
    </ul>
  )
}

function ProfilePage() {
  const { user, logout } = useAuth()
  const { ready, watchlist, watched, stats } = useLibrary()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('watchlist')

  // Signing out lands on a clean login page, not one that sends the next user back to /profile.
  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null

  const tabs: ProfileTab[] = [
    { id: 'watchlist', label: 'Watchlist', count: ready ? watchlist.length : null },
    { id: 'watched', label: 'Watched', count: ready ? watched.length : null },
  ]

  const statItems = [
    { label: 'Watched', value: ready ? stats.watched : '–' },
    { label: 'Queued', value: ready ? stats.queued : '–' },
    { label: 'Movies', value: ready ? stats.movies : '–' },
    { label: 'Series', value: ready ? stats.series : '–' },
  ]

  const titles = activeTab === 'watchlist' ? watchlist : watched
  const empty = emptyMessages[activeTab]

  return (
    <div className="profile">
      <ProfileHeader
        name={user.displayName}
        subtitle={formatJoined(user.createdAt)}
        corner={
          <button
            type="button"
            className="profile__logout"
            aria-label="Log out"
            title="Log out"
            onClick={() => void handleLogout()}
          >
            <Logout2Icon size={18} aria-hidden="true" />
          </button>
        }
      >
        <dl className="profile-stats">
          {statItems.map((stat) => (
            <div className="profile-stats__item" key={stat.label}>
              <dt className="profile-stats__label">{stat.label}</dt>
              <dd className="profile-stats__value">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </ProfileHeader>

      <div className="profile__toolbar">
        {/* Placeholder: the roulette is built later, so the button stays disabled for now. */}
        <button type="button" className="profile__roulette" disabled title="Coming soon">
          <ShuffleIcon size={22} aria-hidden="true" />
          What to watch?
        </button>

        <ProfileTabs
          tabs={tabs}
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as TabId)}
          idPrefix="profile"
        />
      </div>

      <section
        key={activeTab}
        className="profile__panel"
        role="tabpanel"
        id={`profile-panel-${activeTab}`}
        aria-labelledby={`profile-tab-${activeTab}`}
      >
        {!ready ? (
          <ProfileGridSkeleton />
        ) : titles.length > 0 ? (
          <ProfileGrid titles={titles} label={activeTab === 'watchlist' ? 'Watchlist' : 'Watched'} />
        ) : (
          <div className="profile__empty">
            <p className="profile__empty-title">{empty.title}</p>
            <p className="profile__empty-hint">{empty.hint}</p>
            <Link className="profile__empty-link" to={homePath}>
              Browse titles
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}

export default ProfilePage
