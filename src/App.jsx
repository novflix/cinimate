import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StoreProvider, useStore } from './store';
import { ThemeProvider } from './theme';
import { AuthProvider, useAuth } from './auth';
import { AdminProvider, useAdmin } from './admin';
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav';
import Particles from './components/Particles';
import RatingPrompt from './components/RatingPrompt';
import AuthScreen from './pages/AuthScreen';
import Home from './pages/Home';
import Search from './pages/Search';
import Profile from './pages/Profile';
import Recs from './pages/Recs';
import About, { LandingLangSwitcher } from './pages/About';
import ActorPageRoute from './pages/ActorPageRoute';
import PersonPageRoute from './pages/PersonPageRoute';
import StudioPageRoute from './pages/StudioPageRoute';
import PublicListPage from './pages/PublicListPage';
import SimilarPage from './pages/SimilarPage';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import CommunityGuidelines from './pages/CommunityGuidelines';
import NotFound from './pages/Notfound';
import Confetti from './components/Confetti';
import { SnowEffect } from './components/Effects';
import './index.css';

// Moved outside component — date computation runs once at module load
import _pkg from '../package.json';
const _BUILD_DATE = new Date().toISOString().slice(0,10).replace(/-/g,'');

function VersionBadge() {
  return <div className="version-badge">v{_pkg.version} · {_BUILD_DATE}</div>;
}

const PATH_TO_TAB = {
  '/home':    'home',
  '/recs':    'recs',
  '/search':  'search',
  '/profile': 'profile',
  '/about':   'about',
};
const TAB_TO_PATH = {
  home:    '/home',
  recs:    '/recs',
  search:  '/search',
  profile: '/profile',
  about:   '/about',
};


function AppInner() {
  const { pendingRating, setPendingRating, showConfetti } = useStore();
  const { overrides } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const month = new Date().getMonth() + 1;
  const showSnow = overrides.snow || month === 12 || month === 1;

  const activeTab = PATH_TO_TAB[location.pathname] || 'home';

  const handleTabChange = (tab) => {
    navigate(TAB_TO_PATH[tab] || '/');
  };

  return (
    <div className="app-shell">
      <Particles/>
      {showSnow && <SnowEffect/>}
      <div className="ambient-glow"/>
      <SideNav active={activeTab} onChange={handleTabChange}/>
      <div
        className="app-content"
        style={{position:'relative',zIndex:1}}
      >
        <Routes>
          <Route path="/"               element={<Navigate to="/home" replace/>}/>
          <Route path="/home"           element={<Home/>}/>
          <Route path="/recs"           element={<Recs/>}/>
          <Route path="/search"         element={<Search/>}/>
          <Route path="/profile"        element={<Profile/>}/>
          <Route path="/about"          element={<About/>}/>
          <Route path="/terms"          element={<TermsOfService/>}/>
          <Route path="/privacy"        element={<PrivacyPolicy/>}/>
          <Route path="/community"      element={<CommunityGuidelines/>}/>
          <Route path="/actor/:actorId"   element={<ActorPageRoute/>}/>
          <Route path="/person/:personId" element={<PersonPageRoute/>}/>
          <Route path="/studio/:studioId"  element={<StudioPageRoute/>}/>
          <Route path="/list/:listId"   element={<PublicListPage/>}/>
          <Route path="/similar/:type/:id" element={<SimilarPage/>}/>
          <Route path="*"              element={<NotFound/>}/>
        </Routes>
      </div>
      <BottomNav active={activeTab} onChange={handleTabChange}/>
      {pendingRating && (
        <RatingPrompt movie={pendingRating} onClose={() => setPendingRating(null)}/>
      )}
      <Confetti active={showConfetti} color="#22c55e"/>
      <VersionBadge/>
    </div>
  );
}

// Detect desktop (width >= 1024px)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const handler = (e) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

// Auth buttons overlay shown on About page for unauthenticated desktop users
function AboutAuthOverlay({ onLogin, onRegister }) {
  const { t } = useTranslation();
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      display: 'flex', justifyContent: 'flex-end', alignItems: 'center',
      padding: '20px 32px', gap: 10, pointerEvents: 'none',
    }}>
      {/* lang switcher rendered inside About hero, not here */}
      <div style={{ display: 'flex', gap: 10, pointerEvents: 'all', alignItems: 'center' }}>
        <LandingLangSwitcher/>
        <button
          onClick={onLogin}
          style={{
            padding: '10px 22px', borderRadius: 12, fontSize: 14, fontWeight: 600,
            background: 'transparent', color: 'var(--text)',
            border: '1.5px solid var(--border)', cursor: 'pointer',
            transition: 'all 0.18s', backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)'; }}
        >
          {t('auth.signInBtn')}
        </button>
        <button
          onClick={onRegister}
          style={{
            padding: '10px 22px', borderRadius: 12, fontSize: 14, fontWeight: 700,
            background: 'var(--accent)', color: '#000', border: 'none', cursor: 'pointer',
            transition: 'all 0.18s', boxShadow: '0 4px 20px rgba(232,197,71,0.35)',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 28px rgba(232,197,71,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 20px rgba(232,197,71,0.35)'; }}
        >
          {t('auth.signUpBtn')}
        </button>
      </div>
    </div>
  );
}

function Root() {
  const { user } = useAuth();
  const [skipped, setSkipped] = useState(() => localStorage.getItem('auth_skipped') === '1');
  const [authMode, setAuthMode] = useState(null); // 'login' | 'register' | null
  const location = useLocation();
  const isDesktop = useIsDesktop();

  const handleSkip = () => { localStorage.setItem('auth_skipped','1'); setSkipped(true); };

  // Public list pages are accessible without auth
  const isPublicRoute = location.pathname.startsWith('/list/');

  if (user === undefined && !isPublicRoute) return (
    <div style={{position:'fixed',inset:0,background:'var(--bg)',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:32,height:32,border:'2px solid var(--surface2)',borderTopColor:'var(--accent)',borderRadius:'50%',animation:'spin 0.7s linear infinite'}}/>
    </div>
  );

  // Desktop: show About page with auth buttons overlay instead of AuthScreen
  if (!user && !skipped && !isPublicRoute && isDesktop) {
    // If user clicked login/register — show AuthScreen in chosen mode
    if (authMode) {
      return <AuthScreen onSkip={handleSkip} initialMode={authMode} onBack={() => setAuthMode(null)}/>;
    }
    return (
      <>
        <AboutAuthOverlay
          onLogin={() => setAuthMode('login')}
          onRegister={() => setAuthMode('register')}
        />
        <About asLanding onLogin={() => setAuthMode('login')} onRegister={() => setAuthMode('register')}/>
      </>
    );
  }

  if (!user && !skipped && !isPublicRoute) return <AuthScreen onSkip={handleSkip}/>;

  if (isPublicRoute) {
    return (
      <StoreProvider userId={user?.id || null}>
        <AdminProvider userId={user?.id || null}>
          <div className="app-shell">
            <div className="app-content" style={{position:'relative',zIndex:1}}>
              <Routes>
                <Route path="/list/:listId" element={<PublicListPage/>}/>
              </Routes>
            </div>
          </div>
        </AdminProvider>
      </StoreProvider>
    );
  }

  return (
    <StoreProvider userId={user?.id || null}>
      <AdminProvider userId={user?.id || null}>
        <AppInner/>
      </AdminProvider>
    </StoreProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Root/>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}