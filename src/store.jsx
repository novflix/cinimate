import { useState, useEffect, createContext, useContext, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabase';

const StoreContext = createContext(null);
const load = (key, def) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } };
const save = (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} };

// Fix #18: clear all local storage keys on sign-out
export const STORE_KEYS = ['watched','watchlist','ratings','profile','likedActors','dislikedIds','tvProgress','customLists','pinnedIds'];
export function clearLocalStore() {
  STORE_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch {} });
}

// Slim storage: only id + media_type + addedAt stored in cloud/localStorage.
// addedAt (unix ms) powers temporal decay in the recommendation algorithm.
// All display data (title, poster, etc) is fetched from TMDB via useLocalizedMovies.
// This reduces ~350 bytes per item to ~40 bytes — ~89% savings.
const normalize = (movie) => ({
  id:         Number(movie.id),
  media_type: movie.media_type || (movie.title ? 'movie' : 'tv'),
  addedAt:    movie.addedAt || Date.now(),
});

// For migration: detect and strip legacy fat objects already in storage,
// preserving addedAt if it exists (for temporal decay in recommendations).
const slimify = (arr) => {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => ({
    id:         Number(item.id),
    media_type: item.media_type || (item.title ? 'movie' : 'tv'),
    addedAt:    item.addedAt || Date.now(),
  }));
};

// Fix #2: debounced sync — batches all rapid changes into one request
function useDebouncedEffect(fn, deps, delay = 1500) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const t = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}

async function syncToCloud(userId, data) {
  if (!userId) return;
  // Guard: never overwrite cloud with empty/default state — prevents race-condition data wipes.
  const hasRealProfile =
    (data.profile?.name && data.profile.name !== 'Ciniphile') ||
    data.profile?.avatar !== null ||
    (data.profile?.bio && data.profile.bio.length > 0);

  const hasAnyData =
    data.watched.length > 0 ||
    data.watchlist.length > 0 ||
    data.dislikedIds.length > 0 ||
    data.pinnedIds.length > 0 ||
    Object.keys(data.ratings).length > 0 ||
    Object.keys(data.likedActors).length > 0 ||
    Object.keys(data.tvProgress).length > 0 ||
    Object.keys(data.customLists).length > 0 ||
    hasRealProfile;

  // If no meaningful local data at all, check cloud first — do NOT overwrite
  if (!hasAnyData) {
    const { data: cloudRow } = await supabase
      .from('user_data').select('user_id').eq('user_id', userId).single();
    // Cloud row exists → user has data there, don't overwrite with empty state
    if (cloudRow) return;
  }

  const { error: syncError } = await supabase.from('user_data').upsert({
    user_id:     userId,
    watched:     data.watched,
    watchlist:   data.watchlist,
    ratings:     data.ratings,
    profile:     data.profile,
    liked_actors:data.likedActors,
    disliked_ids:data.dislikedIds,
    tv_progress: data.tvProgress,
    custom_lists:data.customLists,
    pinned_ids:  data.pinnedIds,
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (syncError) {
    if (syncError.message?.includes('CINIMATE_DATA_LOSS_PREVENTED')) {
      console.error('[store] Sync blocked by server: suspicious data loss detected. Your data is safe.');
    } else {
      console.warn('[store] syncToCloud error:', syncError.message);
    }
  }
}

async function loadFromCloud(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.from('user_data').select('*').eq('user_id', userId).single();
  // Distinguish: undefined = network/auth error (do NOT allow sync), null = no row yet (safe to create)
  if (error) {
    // PGRST116 = "no rows returned" — that's fine, user just has no data yet
    if (error.code === 'PGRST116') return null;
    console.warn('[store] loadFromCloud error:', error.code, error.message);
    return undefined; // signals a real error — block all sync until resolved
  }
  return data || null;
}

export function StoreProvider({ children, userId }) {
  const [watched,      setWatched]      = useState(() => slimify(load('watched',   [])));
  const [watchlist,    setWatchlist]    = useState(() => slimify(load('watchlist', [])));
  const [ratings,      setRatings]      = useState(() => load('ratings',       {}));
  const [profile,      setProfile]      = useState(() => load('profile',       { name: 'Ciniphile', avatar: null, bio: '' }));
  const [likedActors,  setLikedActors]  = useState(() => load('likedActors',   {}));
  // Fix #6: dislikedIds stored as array in cloud/localStorage but used as Set internally
  const [dislikedIds,  setDislikedIds]  = useState(() => {
    const arr = load('dislikedIds', []);
    return Array.isArray(arr) ? arr : [];
  });
  const [tvProgress,   setTvProgress]   = useState(() => load('tvProgress',    {}));
  const [customLists,  setCustomLists]  = useState(() => load('customLists',   {}));
  // Pinned watchlist item ids (feature: pin items)
  const [pinnedIds,    setPinnedIds]    = useState(() => {
    const v = load('pinnedIds', []);
    return Array.isArray(v) ? v : [];
  });
  const [pendingRating,setPendingRating]= useState(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [syncing,      setSyncing]      = useState(false);
  // cloudLoaded: blocks debounced sync until initial cloud fetch resolves,
  // preventing the race condition where empty state overwrites existing cloud data.
  const [cloudLoaded,  setCloudLoaded]  = useState(!userId);

  // Fix #6: keep a Set for O(1) lookups, derived from array state
  const dislikedSet = useMemo(() => new Set(dislikedIds), [dislikedIds]);
  const pinnedSet   = useMemo(() => new Set(pinnedIds),   [pinnedIds]);

  useEffect(() => {
    if (!userId) return;
    setSyncing(true);
    loadFromCloud(userId).then(data => {
      // undefined = real error (auth/network) — DO NOT set cloudLoaded, block sync entirely
      if (data === undefined) {
        console.warn('[store] Cloud load failed. Sync blocked to protect your data. Will retry on next reload.');
        setSyncing(false);
        // cloudLoaded stays false → debounced sync will never fire → data is safe
        return;
      }
      // data is null = no row yet (new user), data is object = existing user
      if (data) {
        if (data.watched)      { const slim = slimify(data.watched);      setWatched(slim);     save('watched',  slim); }
        if (data.watchlist)    { const slim = slimify(data.watchlist);    setWatchlist(slim);   save('watchlist',slim); }
        if (data.ratings)      { setRatings(data.ratings);           save('ratings',      data.ratings); }
        // Fix profile merge: cloud is authoritative, only fill missing fields from local
        if (data.profile) {
          // Cloud profile always wins — don't let stale localStorage override it
          setProfile(data.profile);
          save('profile', data.profile);
        }
        if (data.liked_actors) { setLikedActors(data.liked_actors);  save('likedActors',  data.liked_actors); }
        if (data.disliked_ids) { setDislikedIds(data.disliked_ids);  save('dislikedIds',  data.disliked_ids); }
        if (data.tv_progress)  { setTvProgress(data.tv_progress);    save('tvProgress',   data.tv_progress); }
        if (data.custom_lists) { setCustomLists(data.custom_lists);  save('customLists',  data.custom_lists); }
        if (data.pinned_ids)   { setPinnedIds(data.pinned_ids);      save('pinnedIds',    data.pinned_ids); }
      }
      setSyncing(false);
      // Only allow debounced sync AFTER successful cloud load
      setCloudLoaded(true);
    });
  }, [userId]);

  useEffect(() => save('watched',     watched),     [watched]);
  useEffect(() => save('watchlist',   watchlist),   [watchlist]);
  useEffect(() => save('ratings',     ratings),     [ratings]);
  useEffect(() => save('profile',     profile),     [profile]);
  useEffect(() => save('likedActors', likedActors), [likedActors]);
  useEffect(() => save('dislikedIds', dislikedIds), [dislikedIds]);
  useEffect(() => save('tvProgress',   tvProgress),   [tvProgress]);
  useEffect(() => save('customLists',  customLists),  [customLists]);
  useEffect(() => save('pinnedIds',    pinnedIds),    [pinnedIds]);

  // Fix #2: single debounced sync, no per-field useEffect timers
  // CRITICAL: cloudLoaded must be true before syncing — prevents race condition
  // where empty initial state overwrites existing cloud data on mount.
  useDebouncedEffect(() => {
    if (!userId || !cloudLoaded) return;
    syncToCloud(userId, { watched, watchlist, ratings, profile, likedActors, dislikedIds, tvProgress, customLists, pinnedIds });
  }, [userId, cloudLoaded, watched, watchlist, ratings, profile, likedActors, dislikedIds, tvProgress, customLists, pinnedIds]);

  // Fix #3: mutations wrapped in useCallback
  const addToWatched = useCallback((movie) => {
    const norm = normalize(movie);
    setWatchlist(prev => prev.filter(m => m.id !== Number(movie.id)));
    setPinnedIds(prev => prev.filter(id => id !== Number(movie.id)));
    setWatched(prev => {
      if (prev.find(m => m.id === Number(movie.id))) return prev;
      // Only show confetti for deliberate user actions (movie object comes from UI)
      setTimeout(() => setPendingRating(norm), 350);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1400);
      return [norm, ...prev];
    });
  }, []);

  const addToWatchlist = useCallback((movie) => {
    setWatched(prev => {
      if (prev.find(m => m.id === Number(movie.id))) return prev;
      setWatchlist(wl => wl.find(m => m.id === Number(movie.id)) ? wl : [normalize(movie), ...wl]);
      return prev;
    });
  }, []);

  const removeFromWatched   = useCallback((id) => {
    setWatched(prev => prev.filter(m => m.id !== Number(id)));
    setRatings(prev => { const n = { ...prev }; delete n[Number(id)]; return n; });
  }, []);
  const removeFromWatchlist = useCallback((id) => {
    setWatchlist(prev => prev.filter(m => m.id !== Number(id)));
    setPinnedIds(prev => prev.filter(pid => pid !== Number(id)));
  }, []);

  const isWatched     = useCallback((id) => watched.some(m => m.id === Number(id)), [watched]);
  const isInWatchlist = useCallback((id) => watchlist.some(m => m.id === Number(id)), [watchlist]);
  const rateMovie     = useCallback((id, score) => setRatings(prev => ({
    ...prev,
    [id]: { score, ratedAt: Date.now() },
  })), []);
  // Backwards-compatible: ratings[id] can be a number (legacy) or { score, ratedAt }
  const getRating     = useCallback((id) => {
    const r = ratings[id];
    if (!r) return null;
    return typeof r === 'object' ? r.score : r;
  }, [ratings]);

  const likeActor   = useCallback((actor) => setLikedActors(prev => ({ ...prev, [actor.id]: { id: actor.id, name: actor.name, profile_path: actor.profile_path || null } })), []);
  const unlikeActor = useCallback((id) => setLikedActors(prev => { const n = {...prev}; delete n[id]; return n; }), []);
  const isActorLiked= useCallback((id) => !!likedActors[id], [likedActors]);

  // Fix #6: O(1) lookup via Set
  const addDisliked = useCallback((id) => setDislikedIds(prev => prev.includes(id) ? prev : [...prev, id]), []);
  const isDisliked  = useCallback((id) => dislikedSet.has(id), [dislikedSet]);

  const setTvProgressEntry = useCallback((id, data) => setTvProgress(prev => ({ ...prev, [id]: { ...prev[id], ...data } })), []);
  const getTvProgress      = useCallback((id) => tvProgress[id] || null, [tvProgress]);
  const clearTvProgress    = useCallback((id) => setTvProgress(prev => { const n = {...prev}; delete n[id]; return n; }), []);

  // ── Watchlist pinning ──────────────────────────────────────────────────────
  const pinWatchlistItem   = useCallback((id) => setPinnedIds(prev => prev.includes(id) ? prev : [id, ...prev]), []);
  const unpinWatchlistItem = useCallback((id) => setPinnedIds(prev => prev.filter(pid => pid !== id)), []);
  const isWatchlistPinned  = useCallback((id) => pinnedSet.has(id), [pinnedSet]);

  // Sorted watchlist: pinned first (preserving pin order), then rest
  const sortedWatchlist = useMemo(() => {
    const pinned = pinnedIds.map(id => watchlist.find(m => m.id === id)).filter(Boolean);
    const rest   = watchlist.filter(m => !pinnedSet.has(m.id));
    return [...pinned, ...rest];
  }, [watchlist, pinnedIds, pinnedSet]);

  // ── Custom Lists ──────────────────────────────────────────────────────────
  const createCustomList = useCallback((name, description = '', image = null, opts = {}) => {
    const id = `list_${Date.now()}`;
    setCustomLists(prev => ({ ...prev, [id]: {
      id, name, description, image, items: Array.isArray(opts.items) ? slimify(opts.items) : [], createdAt: Date.now(),
      showProgress: opts.showProgress !== false,
      deadline: opts.deadline || null,
      isPublic: opts.isPublic !== undefined ? opts.isPublic : true,
      isSiteList: opts.isSiteList || false,
      separateTracking: opts.separateTracking || false,
      listWatched: [],
      listWatchlist: [],
      isOwned: opts.isOwned !== undefined ? opts.isOwned : true,
      authorName: opts.authorName || null,
      sourceListId: opts.sourceListId || null,
      sourceAuthorName: opts.sourceAuthorName || null,
    } }));
    return id;
  }, []);

  const canEditCustomList = (list) => list?.isOwned !== false;

  const deleteCustomList = useCallback((listId) => {
    // Always attempt to remove from public_lists — covers public, site, and share-linked lists.
    // We don't gate on local isPublic flag because the list may have been published via
    // the share button without updating local state, or via the settings modal.
    supabase
      .from('public_lists')
      .delete()
      .eq('id', listId)
      .then(({ error }) => {
        if (error) console.warn('[lists] failed to delete from public_lists:', error.message, error.code);
        else console.log('[lists] deleted from public_lists:', listId);
      });

    setCustomLists(prev => {
      const n = { ...prev };
      delete n[listId];
      return n;
    });
  }, []);

  // Allows the user to take ownership of a previously read-only list (e.g. a liked public list).
  const promoteCustomListOwnership = useCallback((listId) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    if (list.isOwned !== false) return prev;
    return { ...prev, [listId]: { ...list, isOwned: true } };
  }), []);

  const renameCustomList = useCallback((listId, name) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    if (!canEditCustomList(list)) return prev;
    return { ...prev, [listId]: { ...list, name } };
  }), []);

  const addToCustomList = useCallback((listId, movie) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    if (!canEditCustomList(list)) return prev;
    if (list.items.find(m => m.id === Number(movie.id))) return prev;
    return { ...prev, [listId]: { ...list, items: [normalize(movie), ...list.items.map(m=>normalize(m))] } };
  }), []);

  const removeFromCustomList = useCallback((listId, movieId) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    if (!canEditCustomList(list)) return prev;
    return { ...prev, [listId]: { ...list, items: list.items.filter(m => m.id !== Number(movieId)) } };
  }), []);

  const isInCustomList = useCallback((listId, movieId) => !!customLists[listId]?.items.find(m => m.id === Number(movieId)), [customLists]);

  // ── Per-list tracking (separate from global watched/watchlist) ────────────
  const addToListWatched = useCallback((listId, movie) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    const norm = normalize(movie);
    const listWatched = list.listWatched || [];
    const listWatchlist = (list.listWatchlist || []).filter(m => m.id !== norm.id);
    if (listWatched.find(m => m.id === norm.id)) return prev;
    return { ...prev, [listId]: { ...list, listWatched: [norm, ...listWatched], listWatchlist } };
  }), []);

  const removeFromListWatched = useCallback((listId, movieId) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    return { ...prev, [listId]: { ...list, listWatched: (list.listWatched || []).filter(m => m.id !== Number(movieId)) } };
  }), []);

  const addToListWatchlist = useCallback((listId, movie) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    const norm = normalize(movie);
    const listWatched = list.listWatched || [];
    if (listWatched.find(m => m.id === norm.id)) return prev;
    const listWatchlist = list.listWatchlist || [];
    if (listWatchlist.find(m => m.id === norm.id)) return prev;
    return { ...prev, [listId]: { ...list, listWatchlist: [norm, ...listWatchlist] } };
  }), []);

  const removeFromListWatchlist = useCallback((listId, movieId) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    return { ...prev, [listId]: { ...list, listWatchlist: (list.listWatchlist || []).filter(m => m.id !== Number(movieId)) } };
  }), []);

  const isListWatched    = useCallback((listId, movieId) => !!(customLists[listId]?.listWatched || []).find(m => m.id === Number(movieId)), [customLists]);
  const isListInWatchlist= useCallback((listId, movieId) => !!(customLists[listId]?.listWatchlist || []).find(m => m.id === Number(movieId)), [customLists]);
  const updateListMeta = useCallback((listId, meta) => setCustomLists(prev => {
    const list = prev[listId];
    if (!list) return prev;
    if (!canEditCustomList(list)) return prev;
    return { ...prev, [listId]: { ...list, ...meta } };
  }), []);

  // ── Watch time helpers ─────────────────────────────────────────────────────
  // Returns estimated total minutes watched (uses runtime from ratings keys if available)
  // Simple estimation: avg 100 min per movie, 45 min per TV episode
  const totalWatchMinutes = useMemo(() => {
    const movies = watched.filter(m => m.media_type === 'movie').length;
    const tvShows = watched.filter(m => m.media_type === 'tv').length;
    return movies * 100 + tvShows * 45;
  }, [watched]);

  const ctxValue = useMemo(() => ({
    watched, watchlist, sortedWatchlist, ratings, profile, setProfile, syncing,
    likedActors, likeActor, unlikeActor, isActorLiked,
    dislikedIds, addDisliked, isDisliked,
    tvProgress, setTvProgressEntry, getTvProgress, clearTvProgress,
    customLists, createCustomList, deleteCustomList, renameCustomList, promoteCustomListOwnership,
    addToCustomList, removeFromCustomList, isInCustomList, updateListMeta,
    addToListWatched, removeFromListWatched, addToListWatchlist, removeFromListWatchlist,
    isListWatched, isListInWatchlist,
    pendingRating, setPendingRating, showConfetti, setShowConfetti,
    addToWatched, addToWatchlist, removeFromWatched, removeFromWatchlist,
    isWatched, isInWatchlist, rateMovie, getRating,
    pinnedIds, pinWatchlistItem, unpinWatchlistItem, isWatchlistPinned,
    totalWatchMinutes,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [watched, watchlist, sortedWatchlist, ratings, profile, likedActors, dislikedIds,
       tvProgress, customLists, pendingRating, showConfetti, syncing, pinnedIds, totalWatchMinutes]);

  return (
    <StoreContext.Provider value={ctxValue}>
      {children}
    </StoreContext.Provider>
  );
}

export const useStore = () => useContext(StoreContext);