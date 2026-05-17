import { useNavigate } from 'react-router-dom';
import { useMovieModal } from '../hooks/useMovieModal';
import { useTranslation } from 'react-i18next';
import { RefreshLinear } from 'solar-icon-set';
import { useStore } from '../store';
import { useRecommendations } from '../hooks/useRecommendations';
import MovieCard from '../components/MovieCard';
import MovieModal from '../components/MovieModal';
import './Recs.css';

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function Recs() {
  const { likedActors } = useStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selected, openMovie, closeMovie } = useMovieModal();

  const {
    items,
    loading,
    userRefreshing,
    loaderRef,
    handleDislike,
    doReset,
    hasSignals,
  } = useRecommendations();

  const pushNav = (entry) => {
    if (entry.type === 'movie') openMovie(entry.data);
    else if (entry.type === 'actor') navigate(`/actor/${entry.data.id}`, { state: { actor: entry.data } });
  };

  return (
    <div className="page recs-page">
      <div className="recs-header">
        <div>
          <h1 className="recs-header__title">{t('home.forYou')}</h1>
          <p className="recs-header__sub">
            {!hasSignals
              ? t('home.saveMoviesHint')
              : Object.keys(likedActors).length > 0
              ? t('home.basedOnRatingsActors')
              : t('home.basedOnRatingsLists')}
          </p>
        </div>
        <button
          className={'recs-refresh' + (userRefreshing ? ' spinning' : '')}
          onClick={doReset}
          disabled={userRefreshing}
        >
          <RefreshLinear size={18} />
        </button>
      </div>

      {Object.keys(likedActors).length > 0 && (
        <div className="recs-actors">
          {Object.values(likedActors).map(a => (
            <div key={a.id} className="recs-actor-chip">
              {a.profile_path
                ? <img src={`https://image.tmdb.org/t/p/w45${a.profile_path}`} alt={a.name} />
                : <div className="recs-actor-chip__placeholder">{a.name[0]}</div>
              }
              <span>{a.name}</span>
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <div className="recs-grid">
          {items.map(m => (
            <div key={m.id}>
              <MovieCard
                movie={m}
                onClick={m => pushNav({ type: 'movie', data: m })}
                onDislike={handleDislike}
              />
            </div>
          ))}
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="recs-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
            <div key={i} className="skeleton" style={{ borderRadius: 12, aspectRatio: '2/3' }} />
          ))}
        </div>
      )}

      <div ref={loaderRef} style={{ height: 40, marginBottom: 8 }} />
      {loading && items.length > 0 && (
        <div className="recs-loader">
          <div className="recs-spinner" />
        </div>
      )}

      <MovieModal
        movie={selected}
        onClose={closeMovie}
        onActorClick={a => navigate(`/actor/${a.id}`, { state: { actor: a } })}
        onCrewClick={p => navigate(`/person/${p.id}`, { state: { person: p } })}
        onStudioClick={s => navigate(`/studio/${s.id}`, { state: { studio: s } })}
      />
    </div>
  );
}