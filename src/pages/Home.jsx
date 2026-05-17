import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMovieModal } from '../hooks/useMovieModal';
import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StarLinear, PlayLinear, ClapperboardLinear, FlameLinear,
  CupStarLinear, CalendarDateLinear, TVLinear, MagicStickLinear,
  AltArrowLeftLinear, AltArrowRightLinear, ListLinear
} from 'solar-icon-set';
import { tmdb, HEADERS } from '../api';
import { useAdmin } from '../admin';
import { supabase } from '../supabase';
import { useTheme } from '../theme';
import { useLocalizedMovies } from '../useLocalizedMovies';
import MovieCard from '../components/MovieCard';
import MovieModal from '../components/MovieModal';
import ScrollRow from '../components/ScrollRow';
import './Home.css';

/* ─── Cache ─────────────────────────────────────────────────────────────── */
const HOME_CACHE_KEY = 'cinimate_home_cache_v5';
function getHomeCache(lang) {
  try {
    const raw = sessionStorage.getItem(HOME_CACHE_KEY + '_' + lang);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > 5 * 60 * 1000) return null;
    return data;
  } catch { return null; }
}
function setHomeCache(lang, data) {
  try { sessionStorage.setItem(HOME_CACHE_KEY + '_' + lang, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

const CURRENT_YEAR = new Date().getFullYear();
const TMDB_LANG_MAP = { ru: 'ru-RU', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', pt: 'pt-BR', it: 'it-IT', tr: 'tr-TR', zh: 'zh-CN' };

const GENRE_NAMES = {
  18:    { ru: 'Драма',       en: 'Drama'      },
  27:    { ru: 'Ужасы',       en: 'Horror'     },
  28:    { ru: 'Экшн',        en: 'Action'     },
  35:    { ru: 'Комедия',     en: 'Comedy'     },
  53:    { ru: 'Триллер',     en: 'Thriller'   },
  9648:  { ru: 'Мистика',     en: 'Mystery'    },
  10749: { ru: 'Романтика',   en: 'Romance'    },
  10751: { ru: 'Семейное',    en: 'Family'     },
  10765: { ru: 'Sci-Fi',      en: 'Sci-Fi'     },
  14:    { ru: 'Фэнтези',     en: 'Fantasy'    },
  12:    { ru: 'Приключения', en: 'Adventure'  },
  16:    { ru: 'Анимация',    en: 'Animation'  },
};

/* ─── Hero Slider ────────────────────────────────────────────────────────── */
function HeroSlider({ items, onSelect }) {
  const [idx, setIdx] = useState(0);
  const [anim, setAnim] = useState('in');
  const timerRef = useRef(null);

  const goTo = useCallback((next) => {
    setAnim('out');
    setTimeout(() => { setIdx(next); setAnim('in'); }, 350);
  }, []);

  useEffect(() => {
    if (items.length < 2) return;
    timerRef.current = setInterval(() => goTo(p => (p + 1) % items.length), 5500);
    return () => clearInterval(timerRef.current);
  }, [items.length, goTo]);

  const prev = () => { clearInterval(timerRef.current); goTo((idx - 1 + items.length) % items.length); };
  const next = () => { clearInterval(timerRef.current); goTo((idx + 1) % items.length); };

  if (!items.length) return null;
  const hero = items[idx];

  return (
    <div className="hero" onClick={() => onSelect(hero)}>
      <div className={"hero__bg hero__bg--" + anim}>
        {tmdb.backdropUrl(hero.backdrop_path) && <img src={tmdb.backdropUrl(hero.backdrop_path)} alt="" />}
        <div className="hero__fade" />
      </div>
      <div className={"hero__content hero__content--" + anim}>
        <div className="hero__label"><CupStarLinear size={10} /> #{idx + 1} Popular</div>
        <h1 className="hero__title">{hero.title || hero.name}</h1>
        <div className="hero__meta">
          {hero.vote_average > 0 && <span><StarLinear size={12} fill="currentColor" /> {hero.vote_average.toFixed(1)}</span>}
          <span>{(hero.release_date || hero.first_air_date || '').slice(0, 4)}</span>
          {hero.media_type && <span className="hero__type-badge">{hero.media_type === 'tv' ? 'Series' : hero.media_type === 'movie' ? 'Film' : ''}</span>}
        </div>
        <button className="hero__btn" onClick={e => { e.stopPropagation(); onSelect(hero); }}>
          <PlayLinear size={13} fill="currentColor" />
        </button>
      </div>
      {items.length > 1 && <>
        <button className="hero__arrow hero__arrow--left" onClick={e => { e.stopPropagation(); prev(); }}><AltArrowLeftLinear size={20} /></button>
        <button className="hero__arrow hero__arrow--right" onClick={e => { e.stopPropagation(); next(); }}><AltArrowRightLinear size={20} /></button>
      </>}
      <div className="hero__dots" onClick={e => e.stopPropagation()}>
        {items.map((_, i) => (
          <button key={i} className={"hero__dot" + (i === idx ? " active" : "")} onClick={() => { clearInterval(timerRef.current); goTo(i); }} />
        ))}
      </div>
    </div>
  );
}

/* ─── Skeleton Row ───────────────────────────────────────────────────────── */
const SkeletonRow = () => (
  <div className="home-section">
    <div className="skeleton" style={{ height: 13, width: 140, marginBottom: 12, marginLeft: 20, borderRadius: 6 }} />
    <div style={{ display: 'flex', gap: 12, overflow: 'hidden', padding: '0 20px' }}>
      {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ width: 130, flexShrink: 0, borderRadius: 12, paddingBottom: '195px' }} />)}
    </div>
  </div>
);

/* ─── Section Row ────────────────────────────────────────────────────────── */
const SectionRow = memo(function SectionRow({ items, onSelect, showCountdown = false }) {
  return (
    <ScrollRow>
      {items.map(m => (
        <div key={m.id} className="home-section__item">
          <MovieCard movie={m} onClick={onSelect} showCountdown={showCountdown} />
        </div>
      ))}
    </ScrollRow>
  );
});

/* ─── Single titled section ──────────────────────────────────────────────── */
function ContentSection({ Icon, title, items, onSelect, showCountdown = false }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="home-section">
      <h3 className="home-section__title">
        {Icon && <Icon size={15} className="home-section__icon" />}
        {title}
      </h3>
      <SectionRow items={items} onSelect={onSelect} showCountdown={showCountdown} />
    </div>
  );
}

/* ─── Three-slider block (Movies + Series + Animation) ───────────────────── */
function ThreeCatBlock({ movies, series, animation, onSelect, loading }) {
  const { t } = useTranslation();
  const cats = [
    { key: 'movies',    Icon: ClapperboardLinear, label: t('home.catMovies'),    items: movies    },
    { key: 'series',    Icon: TVLinear,           label: t('home.catSeries'),    items: series    },
    { key: 'animation', Icon: MagicStickLinear,   label: t('home.catAnimation'), items: animation },
  ];
  if (loading) return <div className="home-sections" style={{ paddingTop: 18 }}>{cats.map(c => <SkeletonRow key={c.key} />)}</div>;
  return (
    <div className="home-sections" style={{ paddingTop: 18 }}>
      {cats.map(c => (
        <ContentSection key={c.key} Icon={c.Icon} title={c.label} items={c.items} onSelect={onSelect} />
      ))}
    </div>
  );
}

/* ─── Coming Soon Card ───────────────────────────────────────────────────── */
function ComingSoonCard({ movie, onSelect, lang }) {
  const { t } = useTranslation();
  const days = useMemo(() => {
    const d = movie.release_date;
    if (!d) return null;
    const diff = Math.ceil((new Date(d) - new Date()) / 86400000);
    return diff > 0 ? diff : null;
  }, [movie.release_date]);

  const dateLocale = {
    ru: 'ru-RU', en: 'en-GB', de: 'de-DE', es: 'es-ES',
    fr: 'fr-FR', it: 'it-IT', pt: 'pt-BR', tr: 'tr-TR', zh: 'zh-CN',
  }[lang] || 'en-GB';

  return (
    <div className="cs-card" onClick={() => onSelect(movie)}>
      <div className="cs-card__poster">
        {movie.poster_path
          ? <img src={tmdb.posterUrl(movie.poster_path)} alt={movie.title} />
          : <div className="cs-card__no-poster"><ClapperboardLinear size={32} /></div>
        }
        {days !== null && (
          <div className="cs-card__badge">
            <span className="cs-card__days">{days}</span>
            <span className="cs-card__days-label">{t('home.daysLabel')}</span>
          </div>
        )}
      </div>
      <div className="cs-card__info">
        <div className="cs-card__title">{movie.title || movie.name}</div>
        {movie.release_date && (
          <div className="cs-card__date">
            <CalendarDateLinear size={11} />
            {new Date(movie.release_date).toLocaleDateString(dateLocale, { day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Popular Lists ──────────────────────────────────────────────────────── */
function PopularListsContent({ lang }) {
  const [siteLists, setSiteLists] = useState([]);
  const [userLists, setUserLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    supabase
      .from('public_lists')
      .select('id, name, description, image, items, author_name, likes, is_site_list')
      .eq('is_public', true)
      .or('is_site_list.eq.true,likes.gte.100')
      .order('is_site_list', { ascending: false })
      .order('likes', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        const all = data || [];
        setSiteLists(all.filter(l => l.is_site_list));
        setUserLists(all.filter(l => !l.is_site_list));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const allLists = useMemo(() => [...siteLists, ...userLists], [siteLists, userLists]);

  const previewEntries = useMemo(() => {
    const out = [];
    const seen = new Set();
    for (const list of allLists) {
      const slice = (list.items || []).slice(0, 4);
      for (const entry of slice) {
        if (!entry?.id || !entry?.media_type) continue;
        const key = `${entry.id}-${entry.media_type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(entry);
      }
    }
    return out;
  }, [allLists]);

  const localizedPreview = useLocalizedMovies(previewEntries, lang);
  const localizedByKey = useMemo(() => {
    const m = new Map();
    for (const it of localizedPreview) m.set(`${it.id}-${it.media_type}`, it);
    return m;
  }, [localizedPreview]);

  const renderListCard = (list) => {
    const items = list.items || [];
    const posters = list.image
      ? []
      : items
          .slice(0, 4)
          .map(e => localizedByKey.get(`${e?.id}-${e?.media_type}`))
          .filter(Boolean)
          .map(m => tmdb.posterUrl(m.poster_path))
          .filter(Boolean);

    const isSingle = !list.image && posters.length === 1;

    return (
      <div key={list.id} className="pop-list-card" onClick={() => navigate(`/list/${list.id}`)}>
        {isSingle ? (
          <div className="pop-list-card__cover pop-list-card__cover--single">
            <img className="pop-list-card__poster-bg" src={posters[0]} alt="" />
            <img className="pop-list-card__poster-main" src={posters[0]} alt="" />
          </div>
        ) : (
          <div className="pop-list-card__cover" data-count={list.image ? 1 : posters.length}>
            {list.image
              ? <img src={list.image} alt="" style={{gridColumn:'1/-1', gridRow:'1/-1'}}/>
              : posters.length > 0
                ? posters.map((url, i) => <img key={i} src={url} alt=""/>)
                : <div className="pop-list-card__cover--empty"><ListLinear size={24} strokeWidth={1}/></div>
            }
          </div>
        )}
        <div className="pop-list-card__overlay" />
        {items.length > 0 && (
          <span className="pop-list-card__count">{items.length}</span>
        )}
        {list.is_site_list && (
          <span className="pop-list-card__site-badge">{t('home.siteListBadge')}</span>
        )}
        <div className="pop-list-card__info">
          <p className="pop-list-card__name">{list.name}</p>
          <p className="pop-list-card__meta">
            <span className="pop-list-card__author">{list.author_name}</span>
            {list.likes > 0 && <span className="pop-list-card__likes">♥ {list.likes}</span>}
          </p>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="home-sections" style={{paddingTop:18}}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{height:80,borderRadius:14,margin:'0 20px 12px'}}/>)}
    </div>
  );

  if (siteLists.length === 0 && userLists.length === 0) return (
    <div className="placeholder-block">
      <div className="placeholder-block__icon"><CupStarLinear size={40} /></div>
      <h3 className="placeholder-block__title">{t('home.listsEmpty')}</h3>
      <p className="placeholder-block__desc">{t('home.listsEmptyDesc')}</p>
    </div>
  );

  return (
    <div className="popular-lists-wrap">
      {siteLists.length > 0 && (
        <div className="popular-lists-section">
          <div className="popular-lists-section__header">
            <CupStarLinear size={13}/>
            <span>{t('home.siteListsHeader')}</span>
          </div>
          <div className="popular-lists-grid">
            {siteLists.map(renderListCard)}
          </div>
        </div>
      )}
      {userLists.length > 0 && (
        <div className="popular-lists-section">
          {siteLists.length > 0 && (
            <div className="popular-lists-section__header popular-lists-section__header--community">
              <FlameLinear size={13}/>
              <span>{t('home.communityListsHeader')}</span>
            </div>
          )}
          <div className="popular-lists-grid">
            {userLists.map(renderListCard)}
          </div>
        </div>
      )}
    </div>
  );
}

function PopularListsPlaceholder() {
  const { t } = useTranslation();
  const chips = t('home.listsChips', { returnObjects: true });
  return (
    <div className="placeholder-block">
      <div className="placeholder-block__icon"><CupStarLinear size={40} /></div>
      <h3 className="placeholder-block__title">{t('home.listsComingSoon')}</h3>
      <p className="placeholder-block__desc">{t('home.listsComingSoonDesc')}</p>
      <div className="placeholder-block__chips">
        {Array.isArray(chips) && chips.map(c => (
          <div key={c} className="placeholder-block__chip">{c}</div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Tabs ──────────────────────────────────────────────────────────── */
const MAIN_TABS = [
  { id: 'popular',    i18nKey: 'home.tabPopular',     icon: CupStarLinear      },
  { id: 'nowplaying', i18nKey: 'home.tabNowPlaying',  icon: PlayLinear         },
  { id: 'comingsoon', i18nKey: 'home.tabComingSoon',  icon: CalendarDateLinear },
  { id: 'trending',   i18nKey: 'home.tabTrending',   icon: FlameLinear        },
  { id: 'new',        i18nKey: 'home.tabNew',         icon: MagicStickLinear   },
  { id: 'lists',      i18nKey: 'home.tabLists',       icon: CupStarLinear      },
  { id: 'seasonal',   i18nKey: 'home.tabSeasonal',    icon: null               },
];

/* ─── Home Page ──────────────────────────────────────────────────────────── */
export default function Home() {
  const [allData, setAllData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'popular';
  const setActiveTab = (tab) => setSearchParams({ tab }, { replace: false });
  const [animData, setAnimData] = useState({ trending: [], nowplaying: [], popular: [], new: [] });
  const [comingSoon, setComingSoon] = useState([]);
  const [comingSoonLoading, setComingSoonLoading] = useState(true);

  const { selected, openMovie, closeMovie } = useMovieModal();
  const navigate = useNavigate();
  const { lang } = useTheme();
  const { isAdmin } = useAdmin();
  const { t } = useTranslation();
  const langCode    = TMDB_LANG_MAP[lang] || 'en-US';
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const cached = getHomeCache(lang);
    if (cached) { setAllData(cached); setLoading(false); }
    else setLoading(true);

    const JUNK_GENRES = new Set([10764, 10767, 10763, 10766, 10768, 99, 10770]);
    const ADULT_KEYWORDS = /\b(sex|erotic|xxx|porn|nude|naked|adult|hentai|softcore|hardcore|fetish|naughty|seduct|lust|explicit)\b/i;

    // Universal quality filter — poster + backdrop обязательны, без мусора
    const isOK = m =>
      m.poster_path &&
      m.backdrop_path &&
      !m.adult &&
      !(m.genre_ids || []).some(g => JUNK_GENRES.has(g)) &&
      !ADULT_KEYWORDS.test(m.title || m.name || m.original_title || m.original_name || '');

    const isNotAnim = m => !(m.genre_ids || []).includes(16);
    const today = new Date().toISOString().split('T')[0];
    const isReleased = m => { const d = m.release_date || m.first_air_date; return d && d <= today; };

    // Повышенные пороги качества
    const isQM    = m => isOK(m) && isNotAnim(m) && (m.vote_count||0)>=300 && (m.vote_average||0)>=7.0 && (!m.release_date   || m.release_date  >='1980-01-01');
    const isQTV   = m => isOK(m) && (m.vote_count||0)>=150 && (m.vote_average||0)>=7.0 && (!m.first_air_date || m.first_air_date>='1980-01-01');
    // Для Now Playing — чуть мягче, т.к. новинки ещё не набрали голосов
    const isQMNow = m => isOK(m) && isNotAnim(m) && (m.vote_count||0)>=100 && (m.vote_average||0)>=6.5 && isReleased(m);
    const isQTVNow= m => isOK(m) && (m.vote_count||0)>=80  && (m.vote_average||0)>=6.5 && isReleased(m);
    // Для New — совсем свежие, голосов мало, но рейтинг уже виден
    const isQNew  = m => isOK(m) && isNotAnim(m) && (m.vote_count||0)>=50  && (m.vote_average||0)>=6.5 && isReleased(m);

    const oneYearOut = new Date(); oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    const oneYearStr = oneYearOut.toISOString().split('T')[0];

    const csParams = `primary_release_date.gte=${today}&primary_release_date.lte=${oneYearStr}&language=${langCode}&without_genres=10764,10767,10763,10766,10770,99`;
    const csByPop  = `https://api.themoviedb.org/3/discover/movie?${csParams}&sort_by=popularity.desc`;
    const csByDate = `https://api.themoviedb.org/3/discover/movie?${csParams}&sort_by=primary_release_date.asc`;
    setComingSoonLoading(true);
    Promise.all([
      ...[1,2,3,4,5,6,7,8].map(p => fetch(`${csByPop}&page=${p}`,  { headers: HEADERS }).then(r => r.json()).catch(() => ({ results: [] }))),
      ...[1,2,3].map(p =>        fetch(`${csByDate}&page=${p}`, { headers: HEADERS }).then(r => r.json()).catch(() => ({ results: [] }))),
    ]).then(pages => {
      const BLOCKED_GENRES = new Set([10764, 10767, 10763, 10766, 10768, 99, 10770]);
      const all = pages.flatMap(p => p.results || []);
      const filtered = all.filter(m =>
        isOK(m) &&
        m.release_date &&
        m.release_date >= today &&
        m.release_date <= oneYearStr &&
        (m.popularity || 0) >= 6 &&
        !(m.genre_ids || []).some(g => BLOCKED_GENRES.has(g))
      );
      const unique = [...new Map(filtered.map(m => [m.id, m])).values()];
      unique.sort((a, b) => a.release_date.localeCompare(b.release_date));
      setComingSoon(unique.slice(0, 150));
      setComingSoonLoading(false);
    }).catch(() => setComingSoonLoading(false));

    Promise.all([
      tmdb.trending('all','week'),
      tmdb.trending('movie','week'),
      tmdb.trending('tv','week'),
      tmdb.popular('movie',3),
      tmdb.popular('tv',3),
      tmdb.nowPlaying(3),
      tmdb.discover('movie',{primary_release_year:currentYear,sort_by:'popularity.desc','vote_count.gte':50},3),
      tmdb.discover('tv',   {first_air_date_year:currentYear, sort_by:'popularity.desc','vote_count.gte':30},3),
      tmdb.topRated('movie',2),
      tmdb.topRated('tv',2),
    ]).then(([tAll,tM,tTV,popM,popTV,nowP,newM,newTV,topM,topTV])=>{
      const dedup = arr => { const s = new Set(); return arr.filter(m => { if (s.has(m.id)) return false; s.add(m.id); return true; }); };

      // Hero: popular + released + high quality, свежие приоритет
      const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
      const fiveYearsAgoStr = fiveYearsAgo.toISOString().split('T')[0];
      const heroMerged = (() => {
        const movies = (popM.results||[]).filter(m=>isQM(m)&&isReleased(m)).map(m=>({...m,media_type:'movie'}));
        const series = (popTV.results||[]).filter(m=>isQTV(m)&&isReleased(m)).map(m=>({...m,media_type:'tv'}));
        const scoreM  = m => { const d = m.release_date||'';     const fresh = d>=fiveYearsAgoStr?1:0; return fresh*10000+(m.popularity||0); };
        const scoreTV = m => { const d = m.first_air_date||'';   const fresh = d>=fiveYearsAgoStr?1:0; return fresh*10000+(m.popularity||0); };
        movies.sort((a,b)=>scoreM(b)-scoreM(a));
        series.sort((a,b)=>scoreTV(b)-scoreTV(a));
        const merged = []; const len = Math.max(movies.length, series.length);
        for (let i=0; i<len; i++) { if (movies[i]) merged.push(movies[i]); if (series[i]) merged.push(series[i]); }
        return merged;
      })();

      const data = {
        heroItems:        dedup(heroMerged).slice(0,10),
        // Trending — только вышедшие, рейтинг >=6.0
        trendingMovies:   dedup((tM.results||[]).filter(m=>isOK(m)&&isNotAnim(m)&&isReleased(m)&&(m.vote_average||0)>=6.0)).slice(0,30),
        trendingSeries:   dedup((tTV.results||[]).filter(m=>isOK(m)&&isReleased(m)&&(m.vote_average||0)>=6.0).map(m=>({...m,media_type:'tv'}))).slice(0,30),
        // Popular — строгий фильтр, только вышедшие
        popularMovies:    dedup((popM.results||[]).filter(m=>isQM(m)&&isReleased(m))).slice(0,40),
        popularSeries:    dedup((popTV.results||[]).filter(m=>isQTV(m)&&isReleased(m)).map(m=>({...m,media_type:'tv'}))).slice(0,40),
        // Now Playing — свои пороги для свежих релизов
        nowPlayingMovies: dedup((nowP.results||[]).filter(isQMNow)).slice(0,30),
        nowPlayingSeries: dedup((popTV.results||[]).filter(isQTVNow).map(m=>({...m,media_type:'tv'}))).slice(0,20),
        comingSoon: [],
        // New — только вышедшие в этом году с минимальным рейтингом
        newMovies:        dedup((newM.results||[]).filter(isQNew)).slice(0,30),
        newSeries:        dedup((newTV.results||[]).filter(m=>isQNew(m)&&!(m.genre_ids||[]).some(g=>JUNK_GENRES.has(g))).map(m=>({...m,media_type:'tv'}))).slice(0,30),
      };
      setAllData(data);
      setHomeCache(lang,data);
      setLoading(false);
    }).catch(()=>setLoading(false));

    Promise.all([
      // Trending анимация — из trending/week
      fetch(`https://api.themoviedb.org/3/trending/movie/week?language=${langCode}&page=1`,{headers:HEADERS}).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/trending/movie/week?language=${langCode}&page=2`,{headers:HEADERS}).then(r=>r.json()),
      // Now Playing анимация — фильмы в прокате
      fetch(`https://api.themoviedb.org/3/movie/now_playing?language=${langCode}&page=1`,{headers:HEADERS}).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/movie/now_playing?language=${langCode}&page=2`,{headers:HEADERS}).then(r=>r.json()),
      // Popular анимация — discover по популярности, последние 5 лет
      fetch(`https://api.themoviedb.org/3/discover/movie?language=${langCode}&with_genres=16&sort_by=popularity.desc&vote_count.gte=200&primary_release_date.gte=${new Date(new Date().setFullYear(new Date().getFullYear()-5)).toISOString().split('T')[0]}&page=1`,{headers:HEADERS}).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/discover/movie?language=${langCode}&with_genres=16&sort_by=popularity.desc&vote_count.gte=200&primary_release_date.gte=${new Date(new Date().setFullYear(new Date().getFullYear()-5)).toISOString().split('T')[0]}&page=2`,{headers:HEADERS}).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/discover/movie?language=${langCode}&with_genres=16&sort_by=popularity.desc&vote_count.gte=200&primary_release_date.gte=${new Date(new Date().setFullYear(new Date().getFullYear()-5)).toISOString().split('T')[0]}&page=3`,{headers:HEADERS}).then(r=>r.json()),
      // New анимация — этот год, по дате выхода
      fetch(`https://api.themoviedb.org/3/discover/movie?language=${langCode}&with_genres=16&primary_release_year=${currentYear}&sort_by=primary_release_date.desc&vote_count.gte=10&page=1`,{headers:HEADERS}).then(r=>r.json()),
      fetch(`https://api.themoviedb.org/3/discover/movie?language=${langCode}&with_genres=16&primary_release_year=${currentYear}&sort_by=primary_release_date.desc&vote_count.gte=10&page=2`,{headers:HEADERS}).then(r=>r.json()),
    ]).then(([tw1,tw2,np1,np2,pop1,pop2,pop3,ny1,ny2])=>{
      const isAnim    = m => isOK(m) && (m.genre_ids||[]).includes(16) && (m.vote_average||0)>=6.5 && (m.vote_count||0)>=100;
      const isAnimPop = m => isOK(m) && (m.genre_ids||[]).includes(16) && (m.vote_average||0)>=6.5 && (m.vote_count||0)>=200;
      const isAnimNew = m => isOK(m) && (m.genre_ids||[]).includes(16) && (m.vote_count||0)>=10;
      const mergeAnim = (filter, ...pages) => {
        const seen = new Set();
        return pages.flatMap(p=>p.results||[]).filter(m=>{ if(seen.has(m.id))return false; seen.add(m.id); return filter(m); });
      };
      setAnimData({
        trending:   mergeAnim(isAnim,    tw1, tw2).slice(0,25),
        nowplaying: mergeAnim(isAnim,    np1, np2).slice(0,25),
        popular:    mergeAnim(isAnimPop, pop1, pop2, pop3).slice(0,25),
        new:        mergeAnim(isAnimNew, ny1, ny2).slice(0,25),
      });
    }).catch(()=>{});
  },[lang,currentYear,langCode]);

  const handleActorClick = a => navigate(`/actor/${a.id}`,{state:{actor:a}});

  return (
    <div className="page home-page">

      {/* Hero */}
      {!loading && allData && <HeroSlider items={allData.heroItems} onSelect={openMovie}/>}
      {loading && <div className="hero hero--skeleton"><div className="skeleton" style={{width:'100%',height:'100%',borderRadius:0}}/></div>}

      {/* Main Tab Bar */}
      <div className="main-tab-bar-wrap">
        <div className="main-tab-bar">
          {MAIN_TABS.map(tab => {
            const isSeasonal = tab.id === 'seasonal';
            const isActive   = activeTab === tab.id;
            if (isSeasonal) {
              return (
                <button
                  key="seasonal"
                  className={"main-tab main-tab--seasonal-wip" + (isActive ? ' active' : '')}
                  onClick={() => setActiveTab('seasonal')}
                >
                  <MagicStickLinear size={18}/>
                  <span>{t('home.tabSeasonal')}</span>
                </button>
              );
            }
            const label = tab.id === 'new'
              ? t('home.tabNew', { year: CURRENT_YEAR })
              : t(tab.i18nKey);
            return (
              <button
                key={tab.id}
                className={"main-tab" + (isActive ? ' active' : '')}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon && <tab.icon size={18}/>}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">

        {activeTab === 'trending' && (
          <ThreeCatBlock
            movies={allData?.trendingMovies} series={allData?.trendingSeries}
            animation={animData.trending} onSelect={openMovie} loading={loading}
          />
        )}

        {activeTab === 'nowplaying' && (
          <ThreeCatBlock
            movies={allData?.nowPlayingMovies} series={allData?.nowPlayingSeries}
            animation={animData.nowplaying} onSelect={openMovie} loading={loading}
          />
        )}

        {activeTab === 'popular' && (
          <ThreeCatBlock
            movies={allData?.popularMovies} series={allData?.popularSeries}
            animation={animData.popular} onSelect={openMovie} loading={loading}
          />
        )}

        {activeTab === 'new' && (
          <ThreeCatBlock
            movies={allData?.newMovies} series={allData?.newSeries}
            animation={animData.new} onSelect={openMovie} loading={loading}
          />
        )}

        {activeTab === 'comingsoon' && (
          <div className="coming-soon-grid-wrap">
            {comingSoonLoading
              ? [1,2,3,4,5,6].map(i=><div key={i} className="skeleton cs-card-skeleton"/>)
              : comingSoon.length > 0
                ? <div className="coming-soon-grid">
                    {comingSoon.map(m=><ComingSoonCard key={m.id} movie={m} onSelect={openMovie} lang={lang}/>)}
                  </div>
                : <div className="tab-empty">{t('home.noData')}</div>
            }
          </div>
        )}

        {activeTab === 'lists' && (isAdmin ? <PopularListsContent lang={lang}/> : <PopularListsPlaceholder/>)}

        {activeTab === 'seasonal' && (() => {
          const chips = t('home.seasonalChips', { returnObjects: true });
          return (
            <div className="placeholder-block">
              <div className="placeholder-block__icon"><MagicStickLinear size={40} /></div>
              <h3 className="placeholder-block__title">{t('home.seasonalComingSoon')}</h3>
              <p className="placeholder-block__desc">{t('home.seasonalComingSoonDesc')}</p>
              <div className="placeholder-block__chips">
                {Array.isArray(chips) && chips.map(c => <div key={c} className="placeholder-block__chip">{c}</div>)}
              </div>
            </div>
          );
        })()}
      </div>

      <MovieModal
        movie={selected} onClose={closeMovie}
        onActorClick={a=>handleActorClick(a)}
        onCrewClick={p=>navigate(`/person/${p.id}`,{state:{person:p}})}
        onStudioClick={s=>navigate(`/studio/${s.id}`,{state:{studio:s}})}
      />
    </div>
  );
}