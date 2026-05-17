import { useState, useEffect, useRef, useCallback } from 'react';
import { HEADERS, isShowOrAward, traktRelatedBatch } from '../api';
import { useStore } from '../store';
import { useTheme } from '../theme';

const GENRE_ANIMATION     = 16;
const ANIME_COUNTRIES     = new Set(['JP']);
const EASTASIAN_COUNTRIES = new Set(['KR', 'CN', 'TW', 'HK', 'TH']);
const MAX_SAME_GENRE_RUN  = 3;
const MAX_SAME_TYPE_RUN   = 4;
const EXPLORATION_RATE    = 0.12;

const TMDB_LANG_MAP = {
  ru: 'ru-RU', en: 'en-US', es: 'es-ES', fr: 'fr-FR',
  de: 'de-DE', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', zh: 'zh-CN',
};

// Infers the user's preferred release era from their watch history.
function detectEraPreference(watched, watchlist) {
  const all = [...watched, ...watchlist];
  if (all.length === 0) return { minYear: new Date().getFullYear() - 10, preferRecent: true };

  const years = all
    .map(m => parseInt((m.release_date || m.first_air_date || '').slice(0, 4)))
    .filter(y => y > 1900);

  if (years.length === 0) return { minYear: new Date().getFullYear() - 10, preferRecent: true };

  const avg    = years.reduce((s, y) => s + y, 0) / years.length;
  const min    = Math.min(...years);
  const sorted = [...years].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const enjoysClassics = min < 1985;
  const safeMin        = enjoysClassics ? min - 5 : Math.max(median - 8, 1980);
  const preferRecent   = avg > (new Date().getFullYear() - 8);

  return { minYear: safeMin, preferRecent, median };
}

// Builds the user taste profile used to score and filter candidates.
// Rating weights: 9-10 → seed 4.0, 7-8 → 2.5, 5-6 → 0.4 (neutral), 1-4 → genre penalty.
// Finishing a TV show applies a ×1.4 multiplier — strongest positive signal.
export function buildProfile(watched, watchlist, ratings, likedActors, dislikedIds, tvProgress) {
  const seedMovies  = [];
  const genreBoost  = {};
  const originCount = {};
  const { minYear, preferRecent, median } = detectEraPreference(watched, watchlist);

  watched.forEach(m => {
    const r = ratings[m.id];

    if (dislikedIds.includes(m.id)) {
      (m.genre_ids || []).forEach(g => { genreBoost[g] = (genreBoost[g] || 0) - 1.5; });
      return;
    }

    const progress     = tvProgress && m.media_type === 'tv' ? tvProgress[m.id] : null;
    const progressMult = progress?.finished === true ? 1.4 : 1;

    if (!r) {
      seedMovies.push({ id: m.id, media_type: m.media_type || 'movie', weight: 0.8 * progressMult });
      (m.genre_ids || []).forEach(g => { genreBoost[g] = (genreBoost[g] || 0) + 0.3; });
      return;
    }

    if (r >= 9) {
      seedMovies.push({ id: m.id, media_type: m.media_type || 'movie', weight: 4 * progressMult });
      (m.genre_ids || []).forEach(g => { genreBoost[g] = (genreBoost[g] || 0) + 2.5; });
      (m.origin_country || []).forEach(c => { originCount[c] = (originCount[c] || 0) + 2; });
    } else if (r >= 7) {
      seedMovies.push({ id: m.id, media_type: m.media_type || 'movie', weight: 2.5 * progressMult });
      (m.genre_ids || []).forEach(g => { genreBoost[g] = (genreBoost[g] || 0) + 1.2; });
      (m.origin_country || []).forEach(c => { originCount[c] = (originCount[c] || 0) + 1; });
    } else if (r >= 5) {
      seedMovies.push({ id: m.id, media_type: m.media_type || 'movie', weight: 0.4 * progressMult });
    } else {
      (m.genre_ids || []).forEach(g => {
        genreBoost[g] = (genreBoost[g] || 0) - (r <= 2 ? 2.5 : 1.2);
      });
    }
  });

  watchlist.forEach(m => {
    seedMovies.push({ id: m.id, media_type: m.media_type || 'movie', weight: 1.2 });
    (m.genre_ids || []).forEach(g => { genreBoost[g] = (genreBoost[g] || 0) + 0.6; });
  });

  dislikedIds.forEach(id => {
    const movie = [...watched, ...watchlist].find(m => m.id === id);
    if (movie && !ratings[id]) {
      (movie.genre_ids || []).forEach(g => { genreBoost[g] = (genreBoost[g] || 0) - 1.2; });
    }
  });

  const animeInterest     = (originCount['JP'] || 0) >= 2;
  const eastAsianInterest = ['KR','CN','TW','HK','TH'].some(c => (originCount[c] || 0) >= 2);

  // Secondary liked genres (skip top) used for exploration slots.
  const allPositiveGenres = Object.entries(genreBoost)
    .filter(([, v]) => v > 0.3)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => Number(g));
  const explorationGenres = allPositiveGenres.slice(1, 4);

  const seenSeeds = new Set();
  const posSeeds  = seedMovies
    .filter(s => s.weight > 0 && !seenSeeds.has(s.id) && seenSeeds.add(s.id))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 15);

  const avoidIds = new Set([
    ...watched.map(m => m.id),
    ...watchlist.map(m => m.id),
    ...dislikedIds,
  ]);

  return {
    seedMovies: posSeeds,
    likedActorIds: Object.keys(likedActors).map(Number),
    genreBoost,
    avoidIds,
    minYear,
    preferRecent,
    medianYear: median,
    animeInterest,
    eastAsianInterest,
    explorationGenres,
  };
}

// Filters anime and East Asian content when the user shows no interest in them.
// Exception: critically acclaimed titles (≥8.2 rating, ≥2000 votes) always pass.
function passesOriginFilter(item, animeInterest, eastAsianInterest) {
  const countries = item.origin_country || [];

  if (
    !animeInterest &&
    countries.some(c => ANIME_COUNTRIES.has(c)) &&
    (item.genre_ids || []).includes(GENRE_ANIMATION)
  ) return false;

  if (!eastAsianInterest && countries.some(c => EASTASIAN_COUNTRIES.has(c))) {
    const isAcclaimed = (item.vote_average || 0) >= 8.2 && (item.vote_count || 0) >= 2000;
    if (!isAcclaimed) return false;
  }

  return true;
}

// Reorders candidates to prevent long runs of the same genre or media type,
// and injects exploration picks at a fixed interval.
function applyDiversityBuffer(candidates) {
  if (candidates.length === 0) return [];

  const splitIdx     = Math.floor(candidates.length * (1 - EXPLORATION_RATE * 2));
  const mainQueue    = [...candidates.slice(0, splitIdx)];
  const exploreQueue = [...candidates.slice(splitIdx)];
  const result       = [];

  let genreRun      = { genre: null, count: 0 };
  let typeRun       = { type: null,  count: 0 };
  const exploreSlot = Math.round(1 / EXPLORATION_RATE);
  let slot = 0;

  while (mainQueue.length > 0 || exploreQueue.length > 0) {
    slot++;

    if (exploreQueue.length > 0 && slot % exploreSlot === 0) {
      result.push(exploreQueue.shift());
      genreRun = { genre: null, count: 0 };
      typeRun  = { type: null,  count: 0 };
      continue;
    }

    if (mainQueue.length === 0) { result.push(...exploreQueue.splice(0)); break; }

    let picked = null, pickedIdx = -1;
    for (let i = 0; i < Math.min(mainQueue.length, 8); i++) {
      const c  = mainQueue[i];
      const pg = (c.genre_ids || [])[0] || null;
      const pt = c.media_type || 'movie';
      const genreOk = pg === null || genreRun.genre !== pg || genreRun.count < MAX_SAME_GENRE_RUN;
      const typeOk  = typeRun.type !== pt || typeRun.count < MAX_SAME_TYPE_RUN;
      if (genreOk && typeOk) { picked = c; pickedIdx = i; break; }
    }

    if (picked === null) {
      picked = mainQueue[0]; pickedIdx = 0;
      genreRun = { genre: null, count: 0 };
      typeRun  = { type: null,  count: 0 };
    }

    mainQueue.splice(pickedIdx, 1);
    result.push(picked);

    const pg = (picked.genre_ids || [])[0] || null;
    const pt = picked.media_type || 'movie';
    genreRun = pg === genreRun.genre ? { genre: pg, count: genreRun.count + 1 } : { genre: pg, count: 1 };
    typeRun  = pt === typeRun.type   ? { type: pt,  count: typeRun.count + 1  } : { type: pt,  count: 1 };
  }

  return result;
}

function buildDiscoverUrl(base, params) {
  return `${base}?${new URLSearchParams(params)}`;
}

function yearParams(minYear, preferRecent, mediaType = 'movie') {
  const currentYear = new Date().getFullYear();
  const dateField   = mediaType === 'tv' ? 'first_air_date' : 'primary_release_date';
  const cutoff      = preferRecent ? `${currentYear - 12}-01-01` : `${minYear}-01-01`;
  return { [`${dateField}.gte`]: cutoff };
}

// Fetches and scores candidates using four strategies:
// 1. TMDB /recommendations from rotating top seeds
// 1b. Trakt community-based related titles (first 3 pages only)
// 2. Credits of liked actors/directors
// 3. /discover by top liked genres (alternates sort to surface different content across pages)
// 4. Exploration: secondary genres with a score penalty so they land in exploration slots
export async function fetchCandidates(profile, page, langCode) {
  const {
    seedMovies, likedActorIds, genreBoost,
    avoidIds, minYear, preferRecent,
    animeInterest, eastAsianInterest, explorationGenres,
  } = profile;

  const results = [];
  const lang    = `language=${langCode}`;
  const excludeCountries = (animeInterest && eastAsianInterest) ? '' : [
    !animeInterest     ? 'JP' : '',
    !eastAsianInterest ? 'KR,CN,TW,HK,TH' : '',
  ].filter(Boolean).join(',');

  if (seedMovies.length > 0) {
    const numSeeds    = Math.min(4, seedMovies.length);
    const offset      = (page - 1) * numSeeds;
    const uniquePicks = [...new Map(
      Array.from({ length: numSeeds }, (_, i) => seedMovies[(offset + i) % seedMovies.length])
        .map(p => [p.id, p])
    ).values()];

    await Promise.all(uniquePicks.map(async seed => {
      try {
        const recPage = Math.min(((page - 1) % 3) + 1, 3);
        const r = await fetch(
          `https://api.themoviedb.org/3/${seed.media_type}/${seed.id}/recommendations?${lang}&page=${recPage}`,
          { headers: HEADERS }
        ).then(r => r.json());
        (r.results || []).forEach(m => results.push({
          ...m, media_type: seed.media_type, _source_weight: seed.weight, _strategy: 'recs',
        }));
      } catch {}
    }));

    if (page <= 3) {
      try {
        const traktItems = await traktRelatedBatch(uniquePicks.slice(0, 2));
        await Promise.all(traktItems.slice(0, 15).map(async item => {
          try {
            const r = await fetch(
              `https://api.themoviedb.org/3/${item.type}/${item.tmdb_id}?${lang}`,
              { headers: HEADERS }
            ).then(r => r.json());
            if (r.poster_path && (r.vote_average || 0) > 0) {
              results.push({ ...r, media_type: item.type, _source_weight: 1.8, _strategy: 'trakt' });
            }
          } catch {}
        }));
      } catch {}
    }
  }

  if (likedActorIds.length > 0) {
    const actorPick = likedActorIds[(page - 1) % likedActorIds.length];
    try {
      const r = await fetch(
        `https://api.themoviedb.org/3/person/${actorPick}/combined_credits?${lang}`,
        { headers: HEADERS }
      ).then(r => r.json());

      [...(r.cast || []),
        ...(r.crew || []).filter(m => ['Director','Writer','Creator'].includes(m.job)),
      ]
        .map(m => ({ ...m, media_type: m.media_type || 'movie' }))
        .filter(m => !isShowOrAward(m))
        .filter(m => {
          const y = parseInt((m.release_date || m.first_air_date || '0').slice(0, 4));
          return m.poster_path && (m.vote_average || 0) >= 5.5 && (m.vote_count || 0) >= 30 && (!y || y >= minYear);
        })
        .sort((a, b) =>
          b.vote_average * Math.log10(Math.max(b.vote_count || 1, 1)) -
          a.vote_average * Math.log10(Math.max(a.vote_count || 1, 1))
        )
        .slice(0, 30)
        .forEach(m => results.push({ ...m, _source_weight: 3.5, _strategy: 'actor' }));
    } catch {}
  }

  const topGenres = Object.entries(genreBoost)
    .filter(([, score]) => score > 0.5)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([g]) => Number(g))
    .filter(g => g !== GENRE_ANIMATION || animeInterest);

  if (topGenres.length > 0) {
    const excl      = excludeCountries ? { without_origin_country: excludeCountries } : {};
    const movieSort = page % 2 === 0 ? 'vote_average.desc' : 'popularity.desc';
    const tvSort    = page % 3 === 0 ? 'popularity.desc'   : 'vote_average.desc';

    try {
      const [movies, tv] = await Promise.all([
        fetch(buildDiscoverUrl('https://api.themoviedb.org/3/discover/movie', {
          with_genres: String(topGenres[0]), sort_by: movieSort, 'vote_count.gte': '400',
          page: String(page), language: langCode, ...excl, ...yearParams(minYear, preferRecent, 'movie'),
        }), { headers: HEADERS }).then(r => r.json()),
        fetch(buildDiscoverUrl('https://api.themoviedb.org/3/discover/tv', {
          with_genres: String(topGenres[0]), sort_by: tvSort, 'vote_count.gte': '100',
          page: String(page), language: langCode, ...excl, ...yearParams(minYear, preferRecent, 'tv'),
        }), { headers: HEADERS }).then(r => r.json()),
      ]);
      (movies.results || []).forEach(m => results.push({ ...m, media_type: 'movie', _source_weight: 1.2, _strategy: 'genre' }));
      (tv.results    || []).forEach(m => results.push({ ...m, media_type: 'tv',    _source_weight: 1.2, _strategy: 'genre' }));
    } catch {}

    if (topGenres[1]) {
      try {
        const r = await fetch(buildDiscoverUrl('https://api.themoviedb.org/3/discover/movie', {
          with_genres: String(topGenres[1]), sort_by: 'popularity.desc', 'vote_count.gte': '200',
          page: String(page), language: langCode, ...excl, ...yearParams(minYear, preferRecent, 'movie'),
        }), { headers: HEADERS }).then(r => r.json());
        (r.results || []).forEach(m => results.push({ ...m, media_type: 'movie', _source_weight: 0.9, _strategy: 'genre2' }));
      } catch {}
    }
  } else {
    // Fallback when no genre signals exist yet
    try {
      const [tr, topTv] = await Promise.all([
        fetch(`https://api.themoviedb.org/3/trending/movie/week?${lang}&page=${page}`, { headers: HEADERS }).then(r => r.json()),
        fetch(`https://api.themoviedb.org/3/discover/tv?${lang}&sort_by=vote_average.desc&vote_count.gte=200&page=${page}`, { headers: HEADERS }).then(r => r.json()),
      ]);
      (tr.results    || []).forEach(m => results.push({ ...m, media_type: 'movie', _source_weight: 0.5, _strategy: 'fallback' }));
      (topTv.results || []).forEach(m => results.push({ ...m, media_type: 'tv',    _source_weight: 0.5, _strategy: 'fallback' }));
    } catch {}
  }

  if (explorationGenres.length > 0) {
    const expGenre = explorationGenres[page % explorationGenres.length];
    const excl     = excludeCountries ? { without_origin_country: excludeCountries } : {};
    try {
      const r = await fetch(buildDiscoverUrl('https://api.themoviedb.org/3/discover/movie', {
        with_genres: String(expGenre), sort_by: 'vote_average.desc', 'vote_count.gte': '500',
        page: String((page % 5) + 1), language: langCode, ...excl, ...yearParams(minYear, preferRecent, 'movie'),
      }), { headers: HEADERS }).then(r => r.json());
      (r.results || []).forEach(m => results.push({ ...m, media_type: 'movie', _source_weight: 0.7, _strategy: 'explore' }));
    } catch {}
  }

  const seen     = new Set();
  const maxBoost = Math.max(...Object.values(genreBoost).filter(v => v > 0), 1);

  const scored = results
    .filter(m => {
      if (!m.poster_path || avoidIds.has(m.id) || seen.has(m.id) || isShowOrAward(m)) return false;
      if ((m.vote_count || 0) < 15) return false;
      const y = parseInt((m.release_date || m.first_air_date || '0').slice(0, 4));
      if (y && y < minYear) return false;
      if (!passesOriginFilter(m, animeInterest, eastAsianInterest)) return false;
      seen.add(m.id);
      return true;
    })
    .map(m => {
      const tmdbScore = (m.vote_average || 0) / 10;
      const srcWeight = m._source_weight || 1;

      let rawGenre = 0;
      (m.genre_ids || []).forEach(g => { rawGenre += (genreBoost[g] || 0); });

      const normGenre    = (rawGenre / maxBoost) * 0.4;
      const voteSignal   = Math.log10(Math.max(m.vote_count || 1, 1)) / 15;
      const releaseYear  = parseInt((m.release_date || m.first_air_date || '2000').slice(0, 4));
      const recencyBoost = Math.max(0, (releaseYear - 2000) / 400);
      const strategyMult =
        m._strategy === 'actor'   ? 1.4 :
        m._strategy === 'trakt'   ? 1.3 :
        m._strategy === 'recs'    ? 1.1 :
        m._strategy === 'explore' ? 0.85 : 1.0;

      return { ...m, _score: (tmdbScore * srcWeight + normGenre + voteSignal + recencyBoost) * strategyMult };
    })
    .filter(m => m._score > 0)
    .sort((a, b) => b._score - a._score);

  return applyDiversityBuffer(scored);
}

export function useRecommendations() {
  const {
    watched, watchlist, ratings, likedActors,
    dislikedIds, addDisliked, tvProgress,
  } = useStore();
  const { lang } = useTheme();

  const langCode = TMDB_LANG_MAP[lang] || 'en-US';

  const [items,          setItems]          = useState([]);
  const [loading,        setLoading]        = useState(false);
  const [userRefreshing, setUserRefreshing] = useState(false);
  const [observerKey,    setObserverKey]    = useState(0);

  const loaderRef  = useRef(null);
  const loadingRef = useRef(false);
  const profileRef = useRef(null);
  const pageRef    = useRef(1);

  useEffect(() => {
    profileRef.current = buildProfile(watched, watchlist, ratings, likedActors, dislikedIds, tvProgress);
  }, [watched, watchlist, ratings, likedActors, dislikedIds, tvProgress]);

  const doLoad = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    const prof = profileRef.current;
    if (!prof) return;
    loadingRef.current = true;
    if (!reset) setLoading(true);

    const pageOffset = reset ? (profileRef.current._pageOffset || 0) : 0;
    const pg         = reset ? 1 + pageOffset : pageRef.current;

    try {
      let candidates = await fetchCandidates(prof, pg, langCode);

      if (candidates.length < 4 && !reset) {
        const fallbackPage = (pg % 20) + 1;
        candidates      = await fetchCandidates(prof, fallbackPage, langCode);
        pageRef.current = fallbackPage + 1;
      } else {
        pageRef.current = pg + 1;
      }

      if (reset) {
        setItems(candidates);
      } else {
        setItems(prev => {
          const existing = new Set(prev.map(m => m.id));
          return [...prev, ...candidates.filter(m => !existing.has(m.id))];
        });
      }
    } catch (e) {
      console.warn('[useRecommendations] load error:', e);
    } finally {
      setLoading(false);
      setUserRefreshing(false);
      loadingRef.current = false;
      setObserverKey(k => k + 1);
    }
  }, [langCode]);

  const doReset = useCallback(() => {
    const prof      = buildProfile(watched, watchlist, ratings, likedActors, dislikedIds, tvProgress);
    const newOffset = ((profileRef.current?._pageOffset || 0) + Math.floor(Math.random() * 4) + 1) % 10;
    prof._pageOffset   = newOffset;
    profileRef.current = prof;
    pageRef.current    = 1 + newOffset;
    loadingRef.current = false;
    setItems([]);
    setUserRefreshing(true);
    setLoading(true);
    setTimeout(() => doLoad(true), 50);
  }, [watched, watchlist, ratings, likedActors, dislikedIds, tvProgress, doLoad]);

  // Reset feed on language change
  useEffect(() => {
    profileRef.current = buildProfile(watched, watchlist, ratings, likedActors, dislikedIds, tvProgress);
    setItems([]);
    loadingRef.current = false;
    doReset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langCode]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const scrollRoot = el.closest('.app-content') || null;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && !loadingRef.current) doLoad(false); },
      { root: scrollRoot, rootMargin: '600px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [doLoad, observerKey]);

  const handleDislike = useCallback((id) => {
    addDisliked(id);
    setItems(prev => prev.filter(m => m.id !== id));
  }, [addDisliked]);

  const hasSignals =
    watched.length > 0 ||
    watchlist.length > 0 ||
    Object.keys(likedActors).length > 0;

  return { items, loading, userRefreshing, loaderRef, handleDislike, doReset, hasSignals };
}