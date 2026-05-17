import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from 'react-router-dom';
import { ListLinear, AltArrowLeftLinear, HeartAngleLinear, EyeLinear, EyeClosedLinear, BookmarkLinear, BookmarkOpenedLinear } from 'solar-icon-set';
import { useStore } from '../store';
import { useAuth } from '../auth';
import { useLocalizedMovies } from '../useLocalizedMovies';
import { supabase } from '../supabase';
import { tmdb } from '../api';
import MovieModal from '../components/MovieModal';
import './PublicListPage.css';

export default function PublicListPage() {
  const { listId }    = useParams();
  const navigate      = useNavigate();
  const { t }         = useTranslation();

  const [list,    setList]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [selected, setSelected] = useState(null);
  const [copied,  setCopied]  = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked,     setLiked]     = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [copyLoading, setCopyLoading] = useState(false);
  const [copyLabel, setCopyLabel] = useState(null); // null | 'copied' | 'exists' | 'error'

  const { createCustomList, deleteCustomList, customLists, promoteCustomListOwnership,
          isWatched, isInWatchlist, addToWatched, addToWatchlist,
          removeFromWatched, removeFromWatchlist } = useStore();
  const { user } = useAuth();
  const [lang] = useState(() => { try { return localStorage.getItem('lang') || 'en'; } catch { return 'en'; } });
  const listItems = list?.items || [];
  const localizedItems = useLocalizedMovies(listItems, lang);

  // Track which lists the user has liked (localStorage)
  const likedKey = `cinimate_liked_lists`;
  const getLikedSet = () => { try { return new Set(JSON.parse(localStorage.getItem(likedKey) || '[]')); } catch { return new Set(); } };

  useEffect(() => {
    setLoading(true);
    setError(false);
    supabase
      .from('public_lists')
      .select('*')
      .eq('id', listId)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError(true); setLoading(false); return; }
        // Only show if public or owner
        if (data.is_public === false && data.user_id !== user?.id) {
          setError(true); setLoading(false); return;
        }
        setList(data);
        setLikeCount(data.likes || 0);
        setLiked(getLikedSet().has(listId));
        setLoading(false);
      });
  }, [listId]);

  const handleLike = async () => {
    if (likeLoading) return;
    setLikeLoading(true);
    const likedSet = getLikedSet();
    const nowLiked = !liked;
    const delta = nowLiked ? 1 : -1;
    const newCount = Math.max(0, likeCount + delta);

    setLiked(nowLiked);
    setLikeCount(newCount);

    if (nowLiked) likedSet.add(listId); else likedSet.delete(listId);
    try { localStorage.setItem(likedKey, JSON.stringify([...likedSet])); } catch {}

    // Update likes count in supabase
    await supabase.from('public_lists').update({ likes: newCount }).eq('id', listId);

    // If liking — add list to profile as read-only
    if (list && list.user_id !== user?.id) {
      const existingLocal = Object.values(customLists).find(l => l.sourceListId === listId);
      if (nowLiked) {
        if (!existingLocal) {
          createCustomList(list.name, list.description || '', list.image || null, {
            isPublic: false,
            isOwned: false,
            authorName: list.author_name || null,
            sourceListId: listId,
            sourceAuthorName: list.author_name || null,
            items: list.items || [],
          });
        }
      } else {
        if (existingLocal && existingLocal.isOwned === false) {
          deleteCustomList(existingLocal.id);
        }
      }
    }
    setLikeLoading(false);
  };

  const handleCopyList = () => {
    if (copyLoading) return;
    if (!user) {
      alert(t('auth.signInToCopy', 'Please sign in to copy this list'));
      return;
    }
    setCopyLoading(true);
    try {
      const existingLocal = Object.values(customLists).find(l => l.sourceListId === listId);
      if (existingLocal) {
        if (existingLocal.isOwned !== false) {
          setCopyLabel('exists');
          setTimeout(() => setCopyLabel(null), 2200);
        } else {
          promoteCustomListOwnership(existingLocal.id);
          setCopyLabel('copied');
          setTimeout(() => setCopyLabel(null), 2200);
        }
        return;
      }

      createCustomList(list.name, list.description || '', list.image || null, {
        isPublic: false,
        isOwned: true,
        sourceListId: listId,
        sourceAuthorName: list.author_name || null,
        items: list.items || [],
      });
      setCopyLabel('copied');
      setTimeout(() => setCopyLabel(null), 2200);
    } catch (e) {
      console.error(e);
      setCopyLabel('error');
      setTimeout(() => setCopyLabel(null), 2200);
    } finally {
      setCopyLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return (
    <div className="plp-loading">
      <div className="plp-spinner"/>
    </div>
  );

  if (error || !list) return (
    <div className="plp-error">
      <ListLinear size={48} strokeWidth={1}/>
      <h2>{t('publiclist.notFound')}</h2>
      <p>{t('publiclist.notFoundDesc')}</p>
      <button className="plp-home-btn" onClick={() => navigate('/home')}>
        {t('publiclist.goHome')}
      </button>
    </div>
  );

  const items   = list?.items || [];
  const coverPosters = localizedItems.slice(0, 4).map(m => tmdb.posterUrl(m.poster_path)).filter(Boolean);

  return (
    <div className="plp-page">
      {/* Header */}
      <div className="plp-header">
        <button className="plp-back" onClick={() => navigate(-1)}>
          <AltArrowLeftLinear size={20}/>
        </button>

        <div className="plp-hero">
          <div className={`plp-cover ${list.image || coverPosters.length === 1 ? 'plp-cover--single' : ''}`}>
            {list.image
              ? <img src={list.image} alt=""/>
              : coverPosters.length > 0
                ? coverPosters.map((url, i) => <img key={i} src={url} alt=""/>)
                : <div className="plp-cover--empty"><ListLinear size={36} strokeWidth={1}/></div>
            }
          </div>

          <div className="plp-meta">
            <h1 className="plp-title">{list.name}</h1>
            {list.description && <p className="plp-desc">{list.description}</p>}
            <div className="plp-submeta">
              <span className="plp-author">
                {t('publiclist.by', {name: list.author_name || t('profile.anonymous')})}
              </span>
              <span className="plp-count">· {items.length} {t('publiclist.titles')}</span>
            </div>
          </div>
        </div>

        <div className="plp-actions-row">
          <button
            className={"plp-like-btn" + (liked ? ' liked' : '')}
            onClick={handleLike}
            disabled={likeLoading}
          >
            <HeartAngleLinear size={15}/>
            {likeCount > 0 && <span>{likeCount}</span>}
          </button>
          <button className="plp-copy-btn" onClick={handleCopyList} disabled={copyLoading}>
            {copyLabel === 'copied'
              ? t('publiclist.copied', 'Copied')
              : copyLabel === 'exists'
                ? t('publiclist.alreadyCopied', 'Already copied')
                : copyLabel === 'error'
                  ? t('publiclist.error', 'Error')
                  : t('publiclist.copyList', 'Copy list')}
          </button>
          <button className="plp-share-btn" onClick={handleCopyLink}>
            {copied ? (t('publiclist.copied')) : (t('publiclist.copyLink'))}
          </button>
        </div>
      </div>

      {/* Grid */}
      {items.length === 0 ? (
        <div className="plp-empty">
          <ListLinear size={38} strokeWidth={1}/>
          <p>{t('publiclist.listEmpty')}</p>
        </div>
      ) : (
        <div className="plp-grid">
          {localizedItems.map(m => {
            const poster = tmdb.posterUrl(m.poster_path);
            const title  = m.title || m.name || m._fallback_title || '';
            const type   = m.media_type || (m.title ? 'movie' : 'tv');
            const watched = isWatched(m.id);
            const inList  = isInWatchlist(m.id);
            return (
              <div key={m.id} className="plp-item" onClick={() => setSelected(m)}>
                <div className="plp-item__poster">
                  {poster
                    ? <img src={poster} alt={title} loading="lazy"/>
                    : <div className="plp-item__no-poster"><ListLinear size={20}/></div>
                  }
                  <div className="plp-item__overlay">
                    <button
                      className={"plp-item__btn" + (watched ? " plp-item__btn--active-g" : "")}
                      onClick={e => { e.stopPropagation(); watched ? removeFromWatched(m.id) : addToWatched({...m, media_type: type}); }}
                      title={watched ? "Remove from watched" : "Mark as watched"}
                    >
                      {watched ? <EyeClosedLinear size={13}/> : <EyeLinear size={13}/>}
                    </button>
                    <button
                      className={"plp-item__btn" + (inList && !watched ? " plp-item__btn--active-y" : "")}
                      onClick={e => { e.stopPropagation(); inList ? removeFromWatchlist(m.id) : addToWatchlist({...m, media_type: type}); }}
                      disabled={watched}
                      title={inList ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {inList && !watched ? <BookmarkOpenedLinear size={13}/> : <BookmarkLinear size={13}/>}
                    </button>
                  </div>
                </div>
                <p className="plp-item__title">{title}</p>
              </div>
            );
          })}
        </div>
      )}

      <MovieModal movie={selected} onClose={() => setSelected(null)} onActorClick={a=>navigate(`/actor/${a.id}`,{state:{actor:a}})} onCrewClick={p=>navigate(`/person/${p.id}`,{state:{person:p}})} onStudioClick={s=>navigate(`/studio/${s.id}`,{state:{studio:s}})}/>
    </div>
  );
}