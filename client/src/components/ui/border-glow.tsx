import React, { useRef, useCallback, useEffect } from 'react';
import './border-glow.css';

interface BorderGlowProps {
  children?: React.ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
}

interface HSL {
  h: number;
  s: number;
  l: number;
}

function parseHSL(hslStr: string): HSL {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 40, s: 80, l: 80 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function buildGlowVars(glowColor: string, intensity: number): Record<string, string> {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const vars: Record<string, string> = {};
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
  }
  return vars;
}

const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors: string[]): Record<string, string> {
  const vars: Record<string, string> = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
  return vars;
}

function splitPaddingClasses(className: string): [string, string] {
  const classes = className.trim().split(/\s+/);
  const paddings: string[] = [];
  const others: string[] = [];

  classes.forEach(c => {
    if (/^(?:[a-z0-9]+:)?p[xytblr]?(?:-\d+|-\[.*\])?$/.test(c)) {
      paddings.push(c);
    } else {
      others.push(c);
    }
  });

  return [others.join(' '), paddings.join(' ')];
}

function easeOutCubic(x: number): number { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x: number): number { return x * x * x; }

interface AnimateParams {
  start?: number;
  end?: number;
  duration?: number;
  delay?: number;
  ease?: (x: number) => number;
  onUpdate: (v: number) => void;
  onEnd?: () => void;
}

function animateValue({
  start = 0,
  end = 100,
  duration = 1000,
  delay = 0,
  ease = easeOutCubic,
  onUpdate,
  onEnd,
}: AnimateParams) {
  let animId: number;
  let timeoutId: ReturnType<typeof setTimeout>;

  const t0 = performance.now() + delay;
  function tick() {
    const elapsed = performance.now() - t0;
    const t = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) {
      animId = requestAnimationFrame(tick);
    } else if (onEnd) {
      onEnd();
    }
  }

  timeoutId = setTimeout(() => {
    animId = requestAnimationFrame(tick);
  }, delay);

  return () => {
    clearTimeout(timeoutId);
    if (animId) cancelAnimationFrame(animId);
  };
}

const BorderGlow: React.FC<BorderGlowProps> = ({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '263 90 70',
  backgroundColor = 'var(--card)',
  borderRadius = 16,
  glowRadius = 40,
  glowIntensity = 1.0,
  coneSpread = 25,
  animated = true,
  colors = ['#c084fc', '#f472b6', '#38bdf8'],
  fillOpacity = 0.5,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const getCenterOfElement = useCallback((el: HTMLElement): [number, number] => {
    const { width, height } = el.getBoundingClientRect();
    return [width / 2, height / 2];
  }, []);

  const getEdgeProximity = useCallback((el: HTMLElement, x: number, y: number): number => {
    const [cx, cy] = getCenterOfElement(el);
    const dx = x - cx;
    const dy = y - cy;
    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
  }, [getCenterOfElement]);

  const getCursorAngle = useCallback((el: HTMLElement, x: number, y: number): number => {
    const [cx, cy] = getCenterOfElement(el);
    const dx = x - cx;
    const dy = y - cy;
    if (dx === 0 && dy === 0) return 0;
    const radians = Math.atan2(dy, dx);
    let degrees = radians * (180 / Math.PI) + 90;
    if (degrees < 0) degrees += 360;
    return degrees;
  }, [getCenterOfElement]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) return;
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const edge = getEdgeProximity(card, x, y);
    const angle = getCursorAngle(card, x, y);

    card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`);
    card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);
  }, [getEdgeProximity, getCursorAngle]);

  useEffect(() => {
    if (!animated || !cardRef.current) return;
    if (typeof window !== 'undefined' && window.matchMedia('(hover: none)').matches) return;
    const card = cardRef.current;
    let cancels: (() => void)[] = [];

    const observer = new IntersectionObserver(([entry]) => {
      // Clear previous animations if any
      cancels.forEach(c => c());
      cancels = [];

      if (entry.isIntersecting) {
        const angleStart = 110;
        const angleEnd = 465;
        card.classList.add('sweep-active');
        card.style.setProperty('--cursor-angle', `${angleStart}deg`);

        cancels.push(
          animateValue({ duration: 500, onUpdate: v => card.style.setProperty('--edge-proximity', v.toFixed(3)) })
        );
        cancels.push(
          animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: v => {
            card.style.setProperty('--cursor-angle', `${((angleEnd - angleStart) * (v / 100) + angleStart).toFixed(3)}deg`);
          }})
        );
        cancels.push(
          animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: v => {
            card.style.setProperty('--cursor-angle', `${((angleEnd - angleStart) * (v / 100) + angleStart).toFixed(3)}deg`);
          }})
        );
        cancels.push(
          animateValue({ ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0,
            onUpdate: v => card.style.setProperty('--edge-proximity', v.toFixed(3)),
            onEnd: () => card.classList.remove('sweep-active'),
          })
        );
      } else {
        card.classList.remove('sweep-active');
        card.style.setProperty('--edge-proximity', '0');
      }
    }, { threshold: 0.15 });

    observer.observe(card);
    return () => {
      observer.disconnect();
      cancels.forEach(c => c());
    };
  }, [animated]);

  const glowVars = buildGlowVars(glowColor, glowIntensity);
  const [otherClasses, paddingClasses] = splitPaddingClasses(className);

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`border-glow-card ${otherClasses}`}
      style={{
        '--card-bg': backgroundColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': `${borderRadius}px`,
        '--glow-padding': `${glowRadius}px`,
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
        ...glowVars,
        ...buildGradientVars(colors),
      } as React.CSSProperties}
    >
      <span className="edge-light" />
      <div className={`border-glow-inner ${paddingClasses}`}>
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
