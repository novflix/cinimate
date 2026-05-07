import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './NotFound.css';

/* ─── Canvas Particle Field (same as About) ─── */
function ParticleField() {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let W, H, particles, raf;
    const COLORS = ['rgba(232,197,71,', 'rgba(255,107,53,', 'rgba(139,92,246,', 'rgba(59,130,246,'];

    const init = () => {
      W = canvas.width  = canvas.offsetWidth;
      H = canvas.height = canvas.offsetHeight;
      const count = Math.min(Math.floor((W * H) / 12000), 60);
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2,
        r: Math.random() * 1.6 + 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        alpha: Math.random() * 0.5 + 0.08,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.alpha + ')';
        ctx.fill();
      });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = 'rgba(232,197,71,' + (0.06 * (1 - dist / 100)) + ')';
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };

    init();
    draw();
    window.addEventListener('resize', init);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); };
  }, []);

  return <canvas ref={canvasRef} className="nf-particles" />;
}

/* ─── Floating broken/lost movie posters ─── */
const LOST_POSTERS = [
  '/6CoRTJTmijhBLJTUNoVSUNxZMEI.jpg', // Interstellar
  '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', // Oppenheimer
  '/fiVW06jE7z9YnO4trhaMEdclSiC.jpg', // Dune
  '/or06FN3Dka5tukK1e9sl16pB3iy.jpg',  // The Matrix
  '/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg', // Inception
  '/iuFNMS8vlodQgcHc2aHFcep6WBc.jpg', // Blade Runner 2049
  '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', // Pulp Fiction
  '/kuf6dutpsT0vSVehic3EZIqkOBt.jpg', // The Dark Knight
];

function FloatingPosters() {
  return (
    <div className="nf-posters" aria-hidden="true">
      {LOST_POSTERS.map((id, i) => (
        <div key={i} className={`nf-poster nf-poster--${i}`}>
          <img
            src={`https://image.tmdb.org/t/p/w342${id}`}
            alt=""
            loading="lazy"
            onError={e => { e.target.parentElement.style.display = 'none'; }}
          />
          <div className="nf-poster__glitch" />
        </div>
      ))}
    </div>
  );
}

/* ─── Glitch text component ─── */
function GlitchText({ text, className }) {
  return (
    <span className={className} data-text={text} aria-label={text}>
      {text}
    </span>
  );
}

/* ─── Film strip decoration ─── */
function FilmStrip({ frames = 10 }) {
  return (
    <div className="nf-filmstrip" aria-hidden="true">
      {Array.from({ length: frames }).map((_, i) => (
        <div key={i} className="nf-filmstrip__frame">
          <div className="nf-filmstrip__hole nf-filmstrip__hole--top" />
          <div className="nf-filmstrip__hole nf-filmstrip__hole--bot" />
        </div>
      ))}
    </div>
  );
}

/* ─── Tape reel SVG decoration ─── */
function TapeReel({ className }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" opacity="0.3" />
      <circle cx="60" cy="60" r="42" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="60" cy="60" r="12" fill="currentColor" opacity="0.15" />
      <circle cx="60" cy="60" r="6" fill="currentColor" opacity="0.35" />
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 60 + 14 * Math.cos(rad);
        const y1 = 60 + 14 * Math.sin(rad);
        const x2 = 60 + 40 * Math.cos(rad);
        const y2 = 60 + 40 * Math.sin(rad);
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.5" opacity="0.2" />;
      })}
      {[0, 60, 120, 180, 240, 300].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const cx = 60 + 28 * Math.cos(rad);
        const cy = 60 + 28 * Math.sin(rad);
        return <circle key={i} cx={cx} cy={cy} r="5" fill="currentColor" opacity="0.2" />;
      })}
    </svg>
  );
}

/* ─── Main 404 Page ─── */
export default function NotFound() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [scanLine, setScanLine] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Animate scan line
  useEffect(() => {
    let raf;
    let start = null;
    const duration = 3200;
    const tick = (ts) => {
      if (!start) start = ts;
      const progress = ((ts - start) % duration) / duration;
      setScanLine(Math.round(progress * 100));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="nf-page">
      <ParticleField />
      <FloatingPosters />

      {/* Ambient orbs */}
      <div className="nf-orbs" aria-hidden="true">
        <div className="nf-orb nf-orb--1" />
        <div className="nf-orb nf-orb--2" />
        <div className="nf-orb nf-orb--3" />
      </div>

      {/* Scanline effect */}
      <div className="nf-scanline" style={{ top: `${scanLine}%` }} aria-hidden="true" />

      <div className={'nf-content' + (visible ? ' revealed' : '')}>

        {/* Tape reels */}
        <TapeReel className="nf-reel nf-reel--left" />
        <TapeReel className="nf-reel nf-reel--right" />

        {/* Eyebrow */}
        <div className="nf-eyebrow">
          <span className="nf-eyebrow__dot" />
          SCENE NOT FOUND
        </div>

        {/* Giant 404 */}
        <div className="nf-code-wrap" aria-hidden="true">
          <GlitchText text="4" className="nf-digit nf-digit--4a" />
          <div className="nf-zero-wrap">
            <GlitchText text="0" className="nf-digit nf-digit--0" />
            <div className="nf-zero__reel">
              <TapeReel className="nf-zero__reel-svg" />
            </div>
          </div>
          <GlitchText text="4" className="nf-digit nf-digit--4b" />
        </div>
        <p className="nf-sr-only">404</p>

        {/* Film strip */}
        <FilmStrip frames={12} />

        {/* Message */}
        <h1 className="nf-title">
          THE REEL IS <em>MISSING</em>
        </h1>
        <p className="nf-sub">
          Looks like this scene was cut from the final edit.
          <br />
          The page you're looking for doesn't exist — or was moved to the cutting room floor.
        </p>

        {/* Actions */}
        <div className="nf-actions">
          <button
            className="nf-btn nf-btn--primary"
            onClick={() => navigate('/home')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10"/>
            </svg>
            Back to Home
          </button>
          <button
            className="nf-btn nf-btn--outline"
            onClick={() => navigate(-1)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M5 12l7 7M5 12l7-7"/>
            </svg>
            Go Back
          </button>
          <button
            className="nf-btn nf-btn--ghost"
            onClick={() => navigate('/search')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
            Search Films
          </button>
        </div>

        {/* Bottom decoration */}
        <div className="nf-footer-deco" aria-hidden="true">
          <span className="nf-footer-deco__line" />
          <span className="nf-footer-deco__label">CINI<em>MATE</em></span>
          <span className="nf-footer-deco__line" />
        </div>

      </div>
    </div>
  );
}