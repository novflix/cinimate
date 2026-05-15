import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMovieModal } from '../hooks/useMovieModal';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TVLinear, Pen2Linear, SettingsMinimalisticLinear, EyeLinear, BookmarkLinear, PinLinear,
  ShareLinear, CloseCircleLinear, CheckCircleLinear,
  TrashBinMinimalistic2Linear, ListLinear,
  AddCircleLinear, CalendarLinear, Chart2Linear, EyeClosedLinear, BookmarkOpenedLinear,
  HeartLinear, StarLinear, LockKeyholeMinimalisticLinear, HeartAngleLinear, LockKeyholeUnlockedLinear,
  CupStarLinear
} from 'solar-icon-set';
import { useStore } from '../store';
import { useAuth } from '../auth';
import { useAdmin } from '../admin';
import { useTheme } from '../theme';
import { tmdb, HEADERS } from '../api';
import { useLocalizedMovies } from '../useLocalizedMovies';
import Roulette from '../components/Roulette';
import DonateModal from '../components/DonateModal';
import SettingsModal from '../components/SettingsModal';
import MovieModal from '../components/MovieModal';
import Countdown from '../components/Countdown';
import './Profile.css';
import Wordmark from '../components/Wordmark';
import { supabase } from '../supabase';

// ─── Cloudinary avatar upload ─────────────────────────────────────────────────
const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME 
const CLOUDINARY_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

async function uploadToCloudinary(file) {
  // Resize to max 256x256 webp before upload — reduces size ~10x
  const resized = await resizeImage(file, 256);
  const fd = new FormData();
  fd.append('file', resized);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  fd.append('folder', 'cinimate_avatars');
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: 'POST', body: fd,
  });
  if (!res.ok) throw new Error('Cloudinary upload failed');
  const data = await res.json();
  // Return CDN URL with on-the-fly optimisation: 256x256 crop, webp, auto quality
  return data.secure_url.replace('/upload/', '/upload/w_256,h_256,c_fill,q_auto,f_webp/');
}

function resizeImage(file, maxPx) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(maxPx / img.width, maxPx / img.height, 1);
      canvas.width  = Math.round(img.width  * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob(blob => resolve(blob), 'image/webp', 0.85);
    };
    img.src = url;
  });
}

/* ─── Poster Grid ─── */
function PosterGrid({ items, onSelect, onRemove, listTab, getRating, getTvProgress, pinnedIds, pinItem, unpinItem, lang }) {
  const { t } = useTranslation();
  const [pinAnim, setPinAnim] = useState(null);

  const handlePin = (e, id) => {
    e.stopPropagation();
    const isPinned = pinnedIds && pinnedIds.includes(id);
    setPinAnim(id);
    setTimeout(() => setPinAnim(null), 700);
    if (isPinned) unpinItem(id);
    else pinItem(id);
  };

  if (!items.length) return null;
  return (
    <div className="poster-grid">
      {items.map(m => {
        const poster   = tmdb.posterUrl(m.poster_path);
        const title    = m.title || m.name || m._fallback_title || '';
        const rating   = getRating(m.id);
        const isPinned = pinnedIds && pinnedIds.includes(m.id);
        const isAnim   = pinAnim === m.id;
        return (
          <div key={m.id} className={`poster-grid__item${isPinned ? ' poster-grid__item--pinned' : ''}`} onClick={() => onSelect(m)}>
            <div className="poster-grid__poster">
              {poster ? <img src={poster} alt={title} loading="lazy"/> : <div className="poster-grid__no-poster"/>}
              {isPinned && <div className="poster-grid__pin-glow"/>}
              {(() => {
                const rd = m.release_date || m.first_air_date;
                const today = new Date().toISOString().slice(0, 10);
                const isUnreleased = !rd || rd > today;
                if (!isUnreleased) return null;
                return rd ? <Countdown releaseDate={rd}/> : <Countdown noDate={true}/>;
              })()}
              {listTab === 'watched' && rating && (
                <div className="poster-grid__rating"><StarLinear size={11}/>{rating}</div>
              )}
              {listTab === 'watchlist' && getTvProgress?.(m.id) && (() => {
                const p = getTvProgress(m.id);
                return (
                  <div className="poster-grid__progress">
                    <span>S{p.season}·E{p.episode}</span>
                    <div className="poster-grid__progress-bar">
                      <div className="poster-grid__progress-fill" style={{width:`${(()=>{const ts=Math.max(p.totalSeasons||1,1);const eps=p.episodesInSeason||null;const slot=100/ts;const base=(p.season-1)*slot;const frac=(eps&&eps>1)?((p.episode-1)/(eps-1)):0;return Math.min(100,Math.max(0,base+slot*frac));})()}%`}}/>
                    </div>
                  </div>
                );
              })()}
              {listTab === 'watchlist' && (
                <button
                  className={`poster-grid__pin${isPinned ? ' poster-grid__pin--active' : ''}${isAnim ? ' poster-grid__pin--burst' : ''}`}
                  onClick={e => handlePin(e, m.id)}
                  title={isPinned ? t('profile.unpin') : t('profile.pinToTop')}
                >
                  <PinLinear size={12}/>
                </button>
              )}
              <button className="poster-grid__remove" onClick={e=>{e.stopPropagation();onRemove(m.id);}}>
                <TrashBinMinimalistic2Linear size={11}/>
              </button>
            </div>
            <p className="poster-grid__title">{title}</p>
          </div>
        );
      })}
    </div>
  );
}
function WatchlistContent({ listTab, displayItems, localizedWatchlist, onSelect, removeFromWatched, removeFromWatchlist, getRating, getTvProgress, lang, pinnedIds, pinItem, unpinItem }) {
  const { t } = useTranslation();
  if (listTab === 'watched') {
    return <PosterGrid items={displayItems} onSelect={onSelect} onRemove={removeFromWatched} listTab="watched" getRating={getRating} lang={lang}/>;
  }
  const watching = localizedWatchlist.filter(m => (m.media_type==='tv'||(!m.title&&m.name)) && getTvProgress(m.id));
  const queued   = localizedWatchlist.filter(m => !watching.find(w => w.id===m.id));
  return (
    <>
      {watching.length > 0 && (
        <>
          <p className="profile-watching-label"><TVLinear size={13}/> {t('profile.currentlyWatching')}</p>
          <PosterGrid items={watching} onSelect={onSelect} onRemove={removeFromWatchlist} listTab="watchlist" getRating={getRating} getTvProgress={getTvProgress} pinnedIds={pinnedIds} pinItem={pinItem} unpinItem={unpinItem} lang={lang}/>
          {queued.length > 0 && <div className="profile-watching-divider" data-label={t('profile.upNext')}/>}
        </>
      )}
      {queued.length > 0 && (
        <PosterGrid items={queued} onSelect={onSelect} onRemove={removeFromWatchlist} listTab="watchlist" getRating={getRating} getTvProgress={getTvProgress} pinnedIds={pinnedIds} pinItem={pinItem} unpinItem={unpinItem} lang={lang}/>
      )}
    </>
  );
}

/* ─── Title Picker Modal ─── */
function TitlePickerModal({ listItems, onAdd, onClose, lang }) {
  const { t } = useTranslation();
  const TMDB_LANG_MAP = { ru:'ru-RU', en:'en-US', es:'es-ES', fr:'fr-FR', de:'de-DE' };
  const langCode = TMDB_LANG_MAP[lang] || 'en-US';
  const inListIds = new Set(listItems.map(m => m.id));
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        const [movies, tv] = await Promise.all([
          fetch(`https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&language=${langCode}`,{headers:HEADERS}).then(r=>r.json()),
          fetch(`https://api.themoviedb.org/3/search/tv?query=${encodeURIComponent(query)}&language=${langCode}`,{headers:HEADERS}).then(r=>r.json()),
        ]);
        const combined = [
          ...(movies.results||[]).filter(m=>m.poster_path).map(m=>({...m,media_type:'movie'})),
          ...(tv.results||[]).filter(m=>m.poster_path).map(m=>({...m,media_type:'tv'})),
        ].sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,30);
        setResults(combined);
      } catch {}
      setLoading(false);
    }, 350);
  }, [query, langCode]);

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker-panel" onClick={e=>e.stopPropagation()}>
        <div className="picker-header">
          <h3>{t('listeditor.addTitles')}</h3>
          <button onClick={onClose}><CloseCircleLinear size={20}/></button>
        </div>
        <div className="picker-search">
          <input autoFocus className="picker-search__input"
            placeholder={t('listeditor.searchPlaceholder')}
            value={query} onChange={e=>setQuery(e.target.value)}/>
        </div>
        <div className="picker-grid">
          {loading && <div style={{gridColumn:'1/-1',padding:'32px 0',textAlign:'center'}}><div className="search-loading__spinner"/></div>}
          {!loading && results.map(m => {
            const poster = tmdb.posterUrl(m.poster_path);
            const title  = m.title || m.name || '';
            const inList = inListIds.has(m.id);
            return (
              <div key={`${m.id}-${m.media_type}`} className={"picker-item"+(inList?' picker-item--in':'')} onClick={()=>{ if(!inList) onAdd(m); }}>
                <div className="picker-item__poster">
                  {poster ? <img src={poster} alt={title} loading="lazy"/> : <div style={{position:'absolute',inset:0,background:'var(--surface2)'}}/>}
                  {inList && <div className="picker-item__check"><CheckCircleLinear size={16}/></div>}
                </div>
                <p className="picker-item__title">{title}</p>
              </div>
            );
          })}
          {!loading && !results.length && query.trim() && (
            <div style={{gridColumn:'1/-1',padding:'32px 0',textAlign:'center',color:'var(--text3)',fontSize:13}}>
              {t('listeditor.nothingFound')}
            </div>
          )}
          {!loading && !query.trim() && (
            <div style={{gridColumn:'1/-1',padding:'32px 0',textAlign:'center',color:'var(--text3)',fontSize:13}}>
              {t('listeditor.startTyping')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Toggle row ─── */
function ToggleRow({ icon, label, hint, value, onChange }) {
  return (
    <div className="le-toggle-row" onClick={() => onChange(!value)}>
      <div className="le-toggle-row__left">
        <div className="le-toggle-row__icon">{icon}</div>
        <div>
          <p className="le-toggle-row__label">{label}</p>
          {hint && <p className="le-toggle-row__hint">{hint}</p>}
        </div>
      </div>
      <div className={"le-toggle" + (value ? ' on' : '')}>
        <div className="le-toggle__thumb"/>
      </div>
    </div>
  );
}

/* ─── List Edit Page (create & edit) ─── */
function ListEditPage({ listId, customLists, createCustomList, updateListMeta, onBack, onSaved, addToCustomList, lang }) {
  const { t } = useTranslation();
  const { isAdmin } = useAdmin();
  const existing = listId ? customLists[listId] : null;
  const readOnly = !!existing && existing.isOwned === false;
  const [name,         setName]         = useState(existing?.name         || '');
  const [desc,         setDesc]         = useState(existing?.description  || '');
  const [image,        setImage]        = useState(existing?.image        || null);
  const [showProgress, setShowProgress] = useState(existing?.showProgress !== undefined ? existing.showProgress : true);
  const [isPublic, setIsPublic] = useState(existing?.isPublic !== undefined ? existing.isPublic : true);
  const [separateTracking, setSeparateTracking] = useState(existing?.separateTracking || false);
  const [isSiteList,   setIsSiteList]   = useState(existing?.isSiteList   || false);
  const [deadline,     setDeadline]     = useState(existing?.deadline     || '');
  const [currentId,    setCurrentId]    = useState(listId || null);
  const [showPicker,   setShowPicker]   = useState(false);
  const fileRef = useRef();

  const listItems = (currentId && customLists[currentId]?.items) || [];
  // Hydrate slim {id, media_type} objects with poster_path/title from TMDB
  const hydratedListItems = useLocalizedMovies(listItems, lang);

  const [imageUploading, setImageUploading] = useState(false);
  const handleImage = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!f.type.startsWith('image/')) return;
    if (f.size > 5 * 1024 * 1024) { alert(t('profile.imageTooLarge', 'Image must be under 5MB')); return; }
    setImageUploading(true);
    try {
      const url = await uploadToCloudinary(f);
      setImage(url);
    } catch (err) {
      console.error('List image upload failed:', err);
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    if (readOnly) return;
    if (!name.trim()) return;
    // isSiteList forces the list to be public
    const effectiveSiteList = isAdmin && isSiteList;
    const effectivePublic   = isPublic || effectiveSiteList;
    const meta = {
      name: name.trim(),
      description: desc.trim(),
      image,
      showProgress,
      deadline: deadline || null,
      isPublic: effectivePublic,
      separateTracking,
      isSiteList: effectiveSiteList,
    };
    let id = currentId;
    if (id) {
      updateListMeta(id, meta);
    } else {
      id = createCustomList(name.trim(), desc.trim(), image, {
        showProgress,
        deadline: deadline || null,
        isPublic: effectivePublic,
        separateTracking,
        isSiteList: effectiveSiteList,
      });
      setCurrentId(id);
    }

    // Sync to Supabase: upsert if public, delete if private
    try {
      if (effectivePublic) {
        const currentItems = (id && customLists[id]?.items) || listItems;
        await supabase.from('public_lists').upsert({
          id,
          name: meta.name.slice(0, 100),
          description: (meta.description || '').slice(0, 500),
          image: meta.image || null,
          items: currentItems,
          updated_at: new Date().toISOString(),
          is_public: true,
          is_site_list: effectiveSiteList,
          author_name: effectiveSiteList ? 'CiniMate' : undefined,
        }, { onConflict: 'id' });
      } else if (id) {
        await supabase.from('public_lists').delete().eq('id', id);
      }
    } catch (e) {
      console.warn('[lists] supabase sync failed:', e);
    }

    onSaved(id);
  };

  if (readOnly) {
    return (
      <div className="page list-edit-page">
        <div className="list-edit__topbar">
          <button className="list-detail__back" onClick={onBack}><CloseCircleLinear size={20}/></button>
          <h2 className="list-edit__heading">{t('listeditor.readOnly', 'Read-only list')}</h2>
          <button
            className="list-edit__save-btn"
            onClick={() => {
              const base = existing || {};
              const newId = createCustomList(base.name || t('profile.newList'), base.description || '', base.image || null, {
                showProgress: base.showProgress !== false,
                deadline: base.deadline || null,
                isPublic: false,
                separateTracking: base.separateTracking || false,
                sourceListId: base.sourceListId || null,
                sourceAuthorName: base.sourceAuthorName || base.authorName || null,
              });
              (base.items || []).forEach(m => addToCustomList(newId, m));
              onSaved(newId);
            }}
          >
            {t('publiclist.copyList', 'Copy list')}
          </button>
        </div>
        <div style={{padding:'16px', color:'var(--text2)', fontSize:13, lineHeight:1.5}}>
          {t('listeditor.readOnlyDesc', 'This list was added from a public list. Make a copy to edit it.')}
        </div>
      </div>
    );
  }

  return (
    <div className="page list-edit-page">
      <div className="list-edit__topbar">
        <button className="list-detail__back" onClick={onBack}><CloseCircleLinear size={20}/></button>
        <h2 className="list-edit__heading">{currentId ? t('listeditor.editList') : t('listeditor.newList')}</h2>
        <button className="list-edit__save-btn" onClick={handleSave} disabled={!name.trim()}>
          {t('listeditor.save')}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImage}/>

      {/* Cover + fields side by side */}
      <div className="list-edit__form-row">
        <div className="list-edit__cover-wrap" onClick={() => !imageUploading && fileRef.current?.click()}>
          {imageUploading
            ? <div className="list-edit__cover-placeholder"><span style={{fontSize:12,opacity:0.6}}>...</span></div>
            : image
              ? <img className="list-edit__cover-img" src={image} alt="cover" crossOrigin="anonymous" referrerPolicy="no-referrer"/>
              : <div className="list-edit__cover-placeholder">
                  <ListLinear size={26} strokeWidth={1}/>
                  <span>{t('listeditor.cover')}</span>
                </div>
          }
        </div>
        <div className="list-edit__fields">
          <input
            className="list-edit__input"
            placeholder={t('listeditor.titlePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={60}
          />
          <textarea
            className="list-edit__textarea"
            placeholder={t('listeditor.descPlaceholder')}
            value={desc}
            onChange={e => setDesc(e.target.value)}
            maxLength={300}
            rows={3}
          />
        </div>
      </div>

      {/* Options */}
      <div className="list-edit__options list-edit__options--stack">
        <ToggleRow
          icon={isPublic ? <LockKeyholeUnlockedLinear size={16}/> : <LockKeyholeMinimalisticLinear size={16}/>}
          label={isPublic ? t('listeditor.publicList') : t('listeditor.privateList')}
          hint={isPublic ? t('listeditor.publicListHint') : t('listeditor.privateListHint')}
          value={isPublic}
          onChange={setIsPublic}
        />
        <ToggleRow
          icon={<EyeLinear size={16}/>}
          label={t('listeditor.separateTracking')}
          hint={t('listeditor.separateTrackingHint')}
          value={separateTracking}
          onChange={setSeparateTracking}
        />
        <ToggleRow
          icon={<Chart2Linear size={16}/>}
          label={t('listeditor.watchProgress')}
          hint={t('listeditor.watchProgressHint')}
          value={showProgress}
          onChange={setShowProgress}
        />

        <div className="le-deadline-row">
          <div className="le-toggle-row__left">
            <div className="le-toggle-row__icon"><CalendarLinear size={16}/></div>
            <div>
              <p className="le-toggle-row__label">{t('listeditor.deadline')}</p>
              <p className="le-toggle-row__hint">{t('listeditor.deadlineHint')}</p>
            </div>
          </div>
          <input
            type="date"
            className="le-deadline-input"
            value={deadline}
            onChange={e => setDeadline(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        {/* Admin-only: publish as site list */}
        {isAdmin && (
          <ToggleRow
            icon={<CupStarLinear size={16}/>}
            label={t('listeditor.siteList')}
            hint={t('listeditor.siteListHint')}
            value={isSiteList}
            onChange={v => { setIsSiteList(v); if (v) setIsPublic(true); }}
          />
        )}
      </div>

      {/* Add titles */}
      <div style={{padding:'0 16px 12px'}}>
        <button className="custom-lists__new" onClick={() => setShowPicker(true)}>
          <AddCircleLinear size={16}/> {t('listeditor.addTitles')}
        </button>
      </div>

      {hydratedListItems.length > 0 && (
        <div className="poster-grid" style={{padding:'0 16px'}}>
          {hydratedListItems.map(m => {
            const poster = tmdb.posterUrl(m.poster_path);
            const title  = m.title || m.name || m._fallback_title || '';
            return (
              <div key={m.id} className="poster-grid__item">
                <div className="poster-grid__poster">
                  {poster ? <img src={poster} alt={title} loading="lazy"/> : <div className="poster-grid__no-poster"/>}
                </div>
                <p className="poster-grid__title">{title}</p>
              </div>
            );
          })}
        </div>
      )}

      {showPicker && (
        <TitlePickerModal
          listItems={listItems}
          onAdd={m => {
            if (!currentId) {
              const id = createCustomList(name.trim()||t('profile.newList'), desc.trim(), image, { showProgress, deadline: deadline||null });
              setCurrentId(id);
              addToCustomList(id, m);
            } else {
              addToCustomList(currentId, m);
            }
          }}
          onClose={() => setShowPicker(false)}
          lang={lang}
        />
      )}
    </div>
  );
}

/* ─── List Detail Page ─── */
function ListDetailPage({ list, listId, onBack, onSelect, onEdit, removeFromCustomList, addToCustomList, lang }) {
  const { t } = useTranslation();
  // Hydrate slim {id,media_type} items with poster_path, title etc from TMDB
  const localizedItems = useLocalizedMovies(list.items || [], lang);
  const [showPicker,  setShowPicker]  = useState(false);
  const [sharing,     setSharing]     = useState(false);
  const [shareLabel,  setShareLabel]  = useState(null); // null | 'copying' | 'copied' | 'error'
  const { addToWatched, addToWatchlist, removeFromWatched, removeFromWatchlist, isWatched, isInWatchlist,
          addToListWatched, removeFromListWatched, addToListWatchlist, removeFromListWatchlist,
          isListWatched, isListInWatchlist } = useStore();
  const { profile } = useStore();
  const { user } = useAuth();
  const { isAdmin } = useAdmin();
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);

  // Load like count from supabase
  useEffect(() => {
    supabase.from('public_lists').select('likes').eq('id', listId).single()
      .then(({ data }) => { if (data?.likes) setLikeCount(data.likes); });
  }, [listId]);

  const handleShare = async () => {
    setSharing(true);
    setShareLabel('copying');
    try {
      // Upsert the list snapshot to public_lists table
      const payload = {
        id:          listId,
        user_id:     user?.id || null,
        name:        list.name.slice(0, 100),
        description: (list.description || '').slice(0, 500),
        image:       list.image || null,
        items:       list.items,
        author_name: (profile?.name || t('profile.anonymous')).slice(0, 50),
        updated_at:  new Date().toISOString(),
        is_public:   list.isPublic !== false,
      };
      const { error } = await supabase.from('public_lists').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      const url = `${window.location.origin}/list/${listId}`;
      await navigator.clipboard.writeText(url);
      setShareLabel('copied');
      setTimeout(() => setShareLabel(null), 2500);
    } catch (e) {
      console.error(e);
      setShareLabel('error');
      setTimeout(() => setShareLabel(null), 2500);
    }
    setSharing(false);
  };

  // Progress calculation
  const total     = list.items.length;
  const watchedCount = list.separateTracking
    ? list.items.filter(m => isListWatched(listId, m.id)).length
    : list.items.filter(m => isWatched(m.id)).length;
  const pct       = total > 0 ? Math.round((watchedCount / total) * 100) : 0;

  return (
    <div className="page list-detail-page">
      <div className="list-detail__header">
        <button className="list-detail__back" onClick={onBack}>
          <CloseCircleLinear size={20}/>
        </button>
        <div className="list-detail__header-info">
          <div className={`custom-list-card__avatar${(list.image||list.items.length===1)?' custom-list-card__avatar--single':''}`}
               style={{width:72,height:72,borderRadius:12,flexShrink:0}}>
            {list.image
              ? <img src={list.image} alt=""/>
              : localizedItems.slice(0,4).map(m=>tmdb.posterUrl(m.poster_path)).filter(Boolean).length>0
                ? localizedItems.slice(0,4).map(m=>tmdb.posterUrl(m.poster_path)).filter(Boolean).map((url,i)=><img key={i} src={url} alt=""/>)
                : <div className="custom-list-card__avatar--empty"><ListLinear size={28} strokeWidth={1}/></div>
            }
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div className="ldp-title-row">
              <h1 className="list-detail__title">{list.name}</h1>
              <span className={"list-privacy-badge " + (list.isPublic === false ? "list-privacy-badge--private" : "list-privacy-badge--public")}>
                {list.isPublic === false ? <LockKeyholeMinimalisticLinear size={11}/> : <LockKeyholeUnlockedLinear size={11}/>}
              </span>
            </div>
            {list.isOwned === false && list.authorName && (
              <p className="ldp-author">by {list.authorName}</p>
            )}
            {list.isOwned !== false && list.sourceAuthorName && (
              <p className="ldp-author">{t('profile.copiedFrom', 'copied from')} {list.sourceAuthorName}</p>
            )}
            {list.description && <p className="list-detail__desc">{list.description}</p>}
            <p className="list-detail__count">{total} {t('profile.titles')}</p>
            <div className="ldp-actions-row">
              {list.isOwned !== false && (
                <button className="list-detail__edit-btn" onClick={onEdit} title={t('profile.editList')}>
                  <Pen2Linear size={15}/>
                </button>
              )}
              {list.isPublic !== false && list.isOwned !== false && (
                <button
                  className={"list-detail__share-btn" + (shareLabel === 'copied' ? ' copied' : shareLabel === 'error' ? ' error' : '')}
                  onClick={handleShare}
                  disabled={sharing}
                  title={t('profile.share')}
                >
                  <ShareLinear size={15}/>
                  <span>{shareLabel === 'copied' ? t('profile.copied') : shareLabel === 'error' ? t('profile.error') : t('profile.share')}</span>
                </button>
              )}
              {likeCount > 0 && (
                <span className="list-like-count"><HeartAngleLinear size={12}/> {likeCount}</span>
              )}
            </div>

            {/* Progress bar */}
            {list.showProgress !== false && total > 0 && (
              <div className="list-detail__progress">
                <div className="list-detail__progress-bar">
                  <div className="list-detail__progress-fill" style={{width:`${pct}%`}}/>
                </div>
                <span className="list-detail__progress-label">{watchedCount}/{total} · {pct}%</span>
              </div>
            )}

            {/* Deadline */}
            {list.deadline && (
              <div className="list-detail__deadline">
                <CalendarLinear size={12}/>
                {t('profile.deadline')}
                {new Date(list.deadline).toLocaleDateString(lang, {day:'numeric',month:'long',year:'numeric'})}
              </div>
            )}
          </div>
        </div>
      </div>

      {list.items.length === 0 ? (
        <div className="lists-empty">
          <ListLinear size={38} strokeWidth={1}/>
          <p>{t('profile.listIsEmpty')}</p>
          <p style={{fontSize:12,color:'var(--text3)',marginTop:4}}>{t('profile.addViaMenu')}</p>
        </div>
      ) : (
        <div className="poster-grid" style={{padding:'0 16px'}}>
          {localizedItems.map(m => {
            const poster  = tmdb.posterUrl(m.poster_path);
            const title   = m.title || m.name || m._fallback_title || '';
            const watched = isWatched(m.id);
            const inWl    = isInWatchlist(m.id);
            return (
              <div key={m.id} className="poster-grid__item" onClick={() => onSelect(m)}>
                <div className="poster-grid__poster">
                  {poster ? <img src={poster} alt={title} loading="lazy"/> : <div className="poster-grid__no-poster"/>}

                  {(() => {
                    const showW = list.separateTracking ? isListWatched(listId, m.id) : watched;
                    const showWl = list.separateTracking ? isListInWatchlist(listId, m.id) : inWl;
                    return (<>
                      {showW && <div className="movie-card__badge watched"><EyeLinear size={10}/></div>}
                      {!showW && showWl && <div className="movie-card__badge watchlist"><BookmarkLinear size={10}/></div>}
                    </>);
                  })()}

                  {/* Action buttons — identical to MovieCard */}
                  <div className="ldp-overlay" onClick={e => e.stopPropagation()}>
                    {list.separateTracking ? (() => {
                      const lw  = isListWatched(listId, m.id);
                      const lwl = isListInWatchlist(listId, m.id);
                      return (<>
                        <button
                          className={"movie-card__btn" + (lw ? ' g' : '')}
                          onClick={e => { e.stopPropagation(); lw ? removeFromListWatched(listId, m.id) : addToListWatched(listId, m); }}
                          title={lw ? 'Убрать из просмотренных' : 'Отметить просмотренным'}
                        >
                          {lw ? <EyeClosedLinear size={14}/> : <EyeLinear size={14}/>}
                        </button>
                        <button
                          className={"movie-card__btn" + (lwl && !lw ? ' y' : '')}
                          onClick={e => { e.stopPropagation(); if (!lw) { lwl ? removeFromListWatchlist(listId, m.id) : addToListWatchlist(listId, m); } }}
                          disabled={lw}
                          title={lwl ? 'Убрать из очереди' : 'В очередь'}
                        >
                          {lwl && !lw ? <BookmarkOpenedLinear size={14}/> : <BookmarkLinear size={14}/>}
                        </button>
                      </>);
                    })() : (<>
                      <button
                        className={"movie-card__btn" + (watched ? ' g' : '')}
                        onClick={e => { e.stopPropagation(); watched ? removeFromWatched(m.id) : addToWatched(m); }}
                      >
                        {watched ? <EyeClosedLinear size={14}/> : <EyeLinear size={14}/>}
                      </button>
                      <button
                        className={"movie-card__btn" + (inWl && !watched ? ' y' : '')}
                        onClick={e => { e.stopPropagation(); if (!watched) { inWl ? removeFromWatchlist(m.id) : addToWatchlist(m); } }}
                        disabled={watched}
                      >
                        {inWl && !watched ? <BookmarkOpenedLinear size={14}/> : <BookmarkLinear size={14}/>}
                      </button>
                    </>)}
                  </div>

                  {list.isOwned !== false && (
                    <button className="poster-grid__remove" onClick={e=>{e.stopPropagation();removeFromCustomList(listId,m.id);}}>
                      <TrashBinMinimalistic2Linear size={11}/>
                    </button>
                  )}
                </div>
                <p className="poster-grid__title">{title}</p>
              </div>
            );
          })}
        </div>
      )}

      {list.isOwned !== false && (
        <div style={{padding:'16px 16px 0'}}>
          <button className="custom-lists__new" onClick={() => setShowPicker(true)}>
            <AddCircleLinear size={16}/> {t('listeditor.addTitles')}
          </button>
        </div>
      )}

      {showPicker && (
        <TitlePickerModal
          listItems={list.items}
          onAdd={m => addToCustomList(listId, m)}
          onClose={() => setShowPicker(false)}
          lang={lang}
        />
      )}
    </div>
  );
}

/* ─── Custom List Card with hydrated posters ─── */
function CustomListCard({ list, onOpenList, onEditList, onDeleteClick, lang }) {
  const { t } = useTranslation();
  const { isWatched } = useStore();
  // Stabilize the slice reference so useLocalizedMovies doesn't see a new array every render
  const previewItems = useMemo(
    () => list.items.slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [list.items.length, list.id, ...list.items.slice(0, 4).map(i => i.id)]
  );
  const hydratedItems = useLocalizedMovies(previewItems, lang);
  const posters = hydratedItems.map(m => tmdb.posterUrl(m.poster_path)).filter(Boolean);
  const total   = list.items.length;
  const watched = list.items.filter(m => isWatched(m.id)).length;
  const pct     = total > 0 ? Math.round((watched / total) * 100) : 0;

  return (
    <div className="custom-list-card" onClick={() => onOpenList(list.id)}>
      <div className="custom-list-card__avatar">
        {list.image
          ? <img src={list.image} alt=""/>
          : posters.length > 0
            ? posters.map((url, i) => <img key={i} src={url} alt=""/>)
            : <div className="custom-list-card__avatar--empty"><ListLinear size={22} strokeWidth={1}/></div>
        }
      </div>
      <div className="custom-list-card__info">
        <span className="custom-list-card__name">
          {list.isPublic === false && <LockKeyholeMinimalisticLinear size={11} style={{marginRight:4,opacity:0.5}}/>}
          {list.name}
        </span>
        <div className="custom-list-card__meta">
          <span>{total} {t('profile.titles')}</span>
          {list.showProgress !== false && total > 0 && (
            <span className="custom-list-card__pct">{pct}%</span>
          )}
        </div>
        {list.showProgress !== false && total > 0 && (
          <div className="custom-list-card__bar">
            <div className="custom-list-card__bar-fill" style={{width:`${pct}%`}}/>
          </div>
        )}
      </div>
      <div className="custom-list-card__actions">
        {list.isOwned !== false && (
          <button className="custom-list-card__edit" onClick={e=>{e.stopPropagation();onEditList(list.id);}}>
            <Pen2Linear size={13}/>
          </button>
        )}
        <button className="custom-list-card__del" onClick={e=>onDeleteClick(e, list)}>
          <TrashBinMinimalistic2Linear size={13}/>
        </button>
      </div>
    </div>
  );
}

/* ─── Custom Lists Grid ─── */
function CustomListsGrid({ customLists, onOpenList, onEditList, onCreateList, deleteCustomList, lang }) {
  const { t } = useTranslation();
  const lists = Object.values(customLists).sort((a,b) => b.createdAt - a.createdAt);
  const [confirmId, setConfirmId] = useState(null);

  const handleDeleteClick = (e, list) => {
    e.stopPropagation();
    if (list.items.length > 0) { setConfirmId(list.id); } else { deleteCustomList(list.id); }
  };

  const confirmList = confirmId ? customLists[confirmId] : null;

  return (
    <div className="custom-lists">
      {confirmList && (
        <div className="list-confirm-overlay" onClick={()=>setConfirmId(null)}>
          <div className="list-confirm-panel" onClick={e=>e.stopPropagation()}>
            <p className="list-confirm-title">{t('profile.deleteList')}</p>
            <p className="list-confirm-body">
              {t('profile.deleteListBody', {name: confirmList.name, count: confirmList.items.length})}
            </p>
            <div className="list-confirm-actions">
              <button className="list-confirm-cancel" onClick={()=>setConfirmId(null)}>{t('profile.cancel2')}</button>
              <button className="list-confirm-delete" onClick={()=>{deleteCustomList(confirmId);setConfirmId(null);}}>{t('profile.delete')}</button>
            </div>
          </div>
        </div>
      )}

      {lists.length === 0 && (
        <div className="lists-empty">
          <ListLinear size={38} strokeWidth={1}/>
          <p>{t('profile.noCustomLists')}</p>
        </div>
      )}
      <div className="custom-lists__grid">
        {lists.map(list => (
          <CustomListCard
            key={list.id}
            list={list}
            onOpenList={onOpenList}
            onEditList={onEditList}
            onDeleteClick={handleDeleteClick}
            lang={lang}
          />
        ))}
      </div>
      <button className="custom-lists__new" onClick={onCreateList}>
        <AddCircleLinear size={16}/> {t('profile.newList')}
      </button>
    </div>
  );
}

/* ─── Main Profile ─── */
export default function Profile() {
  const {
    profile, setProfile, watched, watchlist, sortedWatchlist,
    removeFromWatched, removeFromWatchlist, getRating, syncing,
    getTvProgress, customLists, createCustomList, deleteCustomList,
    addToCustomList, removeFromCustomList, updateListMeta,
    pinnedIds, pinWatchlistItem, unpinWatchlistItem,
  } = useStore();
  const { user } = useAuth();
  const { lang } = useTheme();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const listTab = searchParams.get('tab') || 'watchlist';
  const setListTab = (tab) => setSearchParams({ tab }, { replace: false });
  const [editing,      setEditing]      = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [name,         setName]         = useState(profile.name);
  const [bio,          setBio]          = useState(profile.bio || '');
  const { selected, openMovie, closeMovie } = useMovieModal();
  const navigate = useNavigate();
  const handleActorClick = (actor) => navigate(`/actor/${actor.id}`, { state: { actor } });
  const [showDonate,   setShowDonate]   = useState(false);
  const [listView,     setListView]     = useState(null);
  const fileRef = useRef();


  const localizedWatched   = useLocalizedMovies(watched,        lang);
  const localizedWatchlist = useLocalizedMovies(sortedWatchlist, lang);

  const handleSave   = () => { setProfile({...profile, name: name.trim().slice(0,30)||'Кинолюб', bio: bio.trim().slice(0,120)}); setEditing(false); };
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Auto-migrate base64 avatar to Cloudinary on first render
  // Runs once per session if avatar is still base64
  useEffect(() => {
    const avatar = profile?.avatar;
    if (!avatar || !avatar.startsWith('data:image')) return;
    // Already migrating or already a URL — skip
    let cancelled = false;
    (async () => {
      try {
        const blob = await (await fetch(avatar)).blob();
        const file = new File([blob], 'avatar.jpg', { type: blob.type });
        const url = await uploadToCloudinary(file);
        if (!cancelled) {
          setProfile(p => ({ ...p, avatar: url }));
        }
      } catch (err) {
        console.warn('[avatar] auto-migration failed:', err.message);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.avatar?.startsWith?.('data:image')]);
  const handleAvatar = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!f.type.startsWith('image/')) return;
    if (f.size > 5 * 1024 * 1024) { alert(t('profile.imageTooLarge', 'Image must be under 5MB')); return; }
    setAvatarUploading(true);
    try {
      const url = await uploadToCloudinary(f);
      setProfile(p => ({ ...p, avatar: url }));
    } catch (err) {
      console.error('Avatar upload failed:', err);
      alert(t('profile.uploadFailed', 'Upload failed, please try again'));
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDelete = () => {
    setProfile({ ...profile, avatar: null });
  };

  const displayItems = listTab === 'watchlist' ? localizedWatchlist : localizedWatched;



  // List detail
  if (listView?.view === 'detail') {
    const list = customLists[listView.id];
    if (!list) { setListView(null); return null; }
    return (
      <>
        <ListDetailPage
          list={list}
          listId={listView.id}
          onBack={() => setListView(null)}
          onSelect={openMovie}
          onEdit={() => setListView({ view: 'edit', id: listView.id })}
          removeFromCustomList={removeFromCustomList}
          addToCustomList={addToCustomList}
          lang={lang}
        />
        <MovieModal movie={selected} onClose={closeMovie} onActorClick={a=>{ handleActorClick(a); }} onCrewClick={p=>{ navigate(`/person/${p.id}`, { state: { person: p } }); }} onStudioClick={s=>{ navigate(`/studio/${s.id}`, { state: { studio: s } }); }}/>
      </>
    );
  }

  // List edit/create
  if (listView?.view === 'edit') {
    return (
      <ListEditPage
        listId={listView.id || null}
        customLists={customLists}
        createCustomList={createCustomList}
        updateListMeta={updateListMeta}
        onBack={() => setListView(prev => prev.id ? { view: 'detail', id: prev.id } : null)}
        onSaved={id => setListView({ view: 'detail', id })}
        addToCustomList={addToCustomList}
        lang={lang}
      />
    );
  }

  return (
    <div className="page profile-page">
      <div className="profile-topbar">
        <div>
          <Wordmark size="sm" className="profile-topbar__title" />
          {user
            ? <p className="profile-topbar__email">{user.email}</p>
            : <p className="profile-topbar__email">{t('profile.guestMode')}</p>
          }
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {syncing && <span className="profile-sync-dot" title="Syncing..."/>}
          {!editing && <button className="profile-icon-btn" onClick={()=>setEditing(true)}><Pen2Linear size={17}/></button>}
          <button className="profile-icon-btn profile-icon-btn--donate" onClick={()=>setShowDonate(true)} title={t('profile.donateBtnTitle')}><HeartLinear size={17}/></button>
          <button className="profile-icon-btn" onClick={()=>setShowSettings(true)}><SettingsMinimalisticLinear size={17}/></button>
        </div>
      </div>

      <div className="profile-card">
        <div className="profile-avatar-wrap" onClick={()=>editing&&fileRef.current?.click()}>
          {profile.avatar
            ? <img className="profile-avatar" src={profile.avatar} alt="avatar" crossOrigin="anonymous" referrerPolicy="no-referrer"/>
            : <div className="profile-avatar profile-avatar--placeholder">{(profile.name||'К')[0].toUpperCase()}</div>
          }
          {editing && <div className="profile-avatar__overlay">{avatarUploading ? <span style={{fontSize:11}}>...</span> : <Pen2Linear size={16}/>}</div>}
        </div>
        {editing && profile.avatar && (
          <button className="profile-avatar__delete-btn" onClick={handleAvatarDelete} title={t('profile.removeAvatar', 'Remove avatar')}>
            <TrashBinMinimalistic2Linear size={13}/>
            {t('profile.removeAvatar', 'Remove avatar')}
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatar}/>

        {editing ? (
          <div className="profile-edit">
            <input className="profile-edit__input" value={name} onChange={e=>setName(e.target.value)} placeholder={t('profile.yourName')} maxLength={30}/>
            <textarea className="profile-edit__bio" value={bio} onChange={e=>setBio(e.target.value)} placeholder={t('profile.aboutTaste')} maxLength={120} rows={2}/>
            <div className="profile-edit__actions">
              <button className="profile-edit__cancel" onClick={()=>{setName(profile.name);setBio(profile.bio||'');setEditing(false);}}>{t('profile.cancel')}</button>
              <button className="profile-edit__save" onClick={handleSave}>{t('profile.save')}</button>
            </div>
          </div>
        ) : (
          <div className="profile-info">
            <h2 className="profile-name">{profile.name}</h2>
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
          </div>
        )}
      </div>

      <div className="profile-stats">
        <div className="profile-stat"><span className="profile-stat__val">{watched.length}</span><span className="profile-stat__label">{t('profile.watched')}</span></div>
        <div className="profile-stat"><span className="profile-stat__val">{watchlist.length}</span><span className="profile-stat__label">{t('profile.queued')}</span></div>
        <div className="profile-stat"><span className="profile-stat__val">{watched.filter(m=>!m.media_type||m.media_type==='movie').length}</span><span className="profile-stat__label">{t('profile.movies')}</span></div>
        <div className="profile-stat"><span className="profile-stat__val">{watched.filter(m=>m.media_type==='tv').length}</span><span className="profile-stat__label">{t('profile.series')}</span></div>

      </div>

      <div className="profile-roulette"><Roulette onMovieClick={openMovie}/></div>

      <div className="profile-lists">
        <div className="lists-tabs">
          <button className={"lists-tab"+(listTab==='watchlist'?" active":"")} onClick={()=>setListTab('watchlist')}>
            <BookmarkLinear size={14}/> {t('profile.watchlist')} <span>{watchlist.length}</span>
          </button>
          <button className={"lists-tab"+(listTab==='watched'?" active":"")} onClick={()=>setListTab('watched')}>
            <EyeLinear size={14}/> {t('profile.watched')} <span>{watched.length}</span>
          </button>
          <button className={"lists-tab lists-tab--small"+(listTab==='lists'?" active":"")} onClick={()=>setListTab('lists')}>
            <ListLinear size={13}/> {t('profile.lists')} <span>{Object.keys(customLists).length}</span>
          </button>
        </div>

        {listTab === 'lists' ? (
          <CustomListsGrid
            customLists={customLists}
            onOpenList={id => setListView({ view: 'detail', id })}
            onEditList={id => { if (customLists[id]?.isOwned === false) return; setListView({ view: 'edit', id }); }}
            onCreateList={() => setListView({ view: 'edit', id: null })}
            deleteCustomList={deleteCustomList}
            lang={lang}
          />
        ) : displayItems.length === 0 ? (
          <div className="lists-empty">
            {listTab==='watchlist' ? <BookmarkLinear size={38} strokeWidth={1}/> : <EyeLinear size={38} strokeWidth={1}/>}
            <p>{listTab==='watchlist' ? t('profile.listEmpty') : t('home.nothingYet')}</p>
          </div>
        ) : (
          <WatchlistContent
            listTab={listTab}
            displayItems={displayItems}
            localizedWatchlist={localizedWatchlist}
            onSelect={openMovie}
            removeFromWatched={removeFromWatched}
            removeFromWatchlist={removeFromWatchlist}
            getRating={getRating}
            getTvProgress={getTvProgress}
            lang={lang}
            pinnedIds={pinnedIds}
            pinItem={pinWatchlistItem}
            unpinItem={unpinWatchlistItem}
          />
        )}
      </div>

      <MovieModal movie={selected} onClose={closeMovie} onActorClick={a=>{ handleActorClick(a); }} onCrewClick={p=>{ navigate(`/person/${p.id}`, { state: { person: p } }); }} onStudioClick={s=>{ navigate(`/studio/${s.id}`, { state: { studio: s } }); }}/>
      {showSettings && <SettingsModal onClose={()=>setShowSettings(false)}/>}
      {showDonate && <DonateModal onClose={()=>setShowDonate(false)}/>}
    </div>
  );
}