import { useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import concertImg from '@/assets/concert.png';
import SemLogo from '@/components/SemLogo';
import '@/styles/landing.css';

/* ── Interactive dot‑grid canvas ── */
function DotCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -1000, y: -1000 });
  const dots = useRef<{ baseX: number; baseY: number; x: number; y: number; r: number; color: string }[]>([]);
  const raf = useRef(0);

  const COLORS = [
    'rgba(255,255,255,.30)',
    'rgba(200,200,210,.35)',
    'rgba(160,165,175,.30)',
    'rgba(130,135,145,.25)',
  ];

  const initDots = useCallback((w: number, h: number) => {
    const gap = 32;
    const arr: typeof dots.current = [];
    for (let x = gap / 2; x < w; x += gap) {
      for (let y = gap / 2; y < h; y += gap) {
        arr.push({
          baseX: x,
          baseY: y,
          x,
          y,
          r: 3,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }
    dots.current = arr;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const parent = canvas.parentElement!;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      initDots(canvas.width, canvas.height);
    };

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onLeave = () => {
      mouse.current = { x: -1000, y: -1000 };
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const mx = mouse.current.x;
      const my = mouse.current.y;
      const radius = 180;
      const ease = 0.025; // slower easing for a gentle delay

      for (const dot of dots.current) {
        const dx = mx - dot.baseX;
        const dy = my - dot.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        let targetX = dot.baseX;
        let targetY = dot.baseY;
        let targetR = 3;

        if (dist < radius) {
          const force = (radius - dist) / radius;
          const angle = Math.atan2(dy, dx);
          targetX = dot.baseX - Math.cos(angle) * force * 30;
          targetY = dot.baseY - Math.sin(angle) * force * 30;
          targetR = 3 + force * 5;
        }

        dot.x += (targetX - dot.x) * ease;
        dot.y += (targetY - dot.y) * ease;
        dot.r += (targetR - dot.r) * ease;

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
        ctx.fillStyle = dot.color;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener('resize', resize);
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);
    raf.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf.current);
    };
  }, [initDots]);

  return <canvas ref={canvasRef} className="dot-canvas" />;
}

/* ── Landing page ── */
export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Left — hero image */}
      <div className="landing-left">
        <img src={concertImg} alt="Crowd at a live concert with stage lights" className="landing-hero-img" />
        <div className="landing-img-overlay" />
      </div>

      {/* Right — actions + dot animation */}
      <div className="landing-right">
        <DotCanvas />

        <div className="landing-content">
          <div className="landing-logo">
            <SemLogo height={88} color="#ffffff" />
          </div>
          <p className="landing-tagline">
            Discover events, meet people, and make memories.
          </p>

          <div className="landing-actions">
            <button className="landing-btn landing-btn--primary" onClick={() => navigate('/login')}>
              Sign In
            </button>
            <button className="landing-btn landing-btn--outline" onClick={() => navigate('/register')}>
              Sign Up
            </button>
            <button className="landing-btn landing-btn--ghost" onClick={() => navigate('/discover')}>
              Continue without activation →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
