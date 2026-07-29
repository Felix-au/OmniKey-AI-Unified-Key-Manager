import { useEffect, useState, useRef } from 'react';

const CONFIG = {
  idleDotSize: 8,
  idleRingSize: 28,
  hoverRingSize: 52,
  lerpSpeed: 0.16,
  lerpSpeedMagnetic: 0.24,
};

export default function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [isMagnetic, setIsMagnetic] = useState(false);
  const [rippleActive, setRippleActive] = useState(false);

  // Mouse coords (instantly updated)
  const mouseRef = useRef({ x: 0, y: 0 });
  
  // Outer ring animated state (lerped)
  const ringRef = useRef({
    x: 0,
    y: 0,
    w: CONFIG.idleRingSize,
    h: CONFIG.idleRingSize,
    r: 9999, // border-radius
  });

  // Track hovered element bounding rect and styles
  const hoverTargetRef = useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
  } | null>(null);

  const dotElRef = useRef<HTMLDivElement>(null);
  const ringElRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Enable custom cursor only on desktop/pointer devices
    const isTouch = window.matchMedia('(hover: none)').matches;
    if (isTouch) return;
    setEnabled(true);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseDown = () => {
      setIsClicked(true);
    };

    const handleMouseUp = () => {
      setIsClicked(false);
      // Trigger click ripple effect
      setRippleActive(false);
      setTimeout(() => setRippleActive(true), 10);
    };

    // Event delegation for hover states
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const interactive = target.closest<HTMLElement>(
        'a, button, select, input[type="submit"], input[type="button"], [role="button"], .interactive-hover, .cursor-pointer, [class*="cursor-pointer"], .provider-pill, .stat-num'
      );

      // Check if it's a text input or text area (we want to restore native cursor and hide ring)
      const isTextInput = target.closest(
        'input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="number"], textarea, [contenteditable="true"]'
      );

      if (isTextInput) {
        setIsHovered(false);
        setIsMagnetic(false);
        hoverTargetRef.current = null;
        if (ringElRef.current) ringElRef.current.style.opacity = '0';
        if (dotElRef.current) dotElRef.current.style.opacity = '0';
        return;
      }

      // Restore outer ring / dot visibility if coming back from text input
      if (ringElRef.current) ringElRef.current.style.opacity = '1';
      if (dotElRef.current) dotElRef.current.style.opacity = '1';

      if (interactive) {
        setIsHovered(true);
        const rect = interactive.getBoundingClientRect();
        
        // Only wrap elements that are relatively small (icons, nav links, buttons)
        const isSmall = rect.width <= 140 && rect.height <= 140;

        if (isSmall) {
          setIsMagnetic(true);
          const computedStyle = window.getComputedStyle(interactive);
          const rawRadius = parseFloat(computedStyle.borderRadius) || 8;

          hoverTargetRef.current = {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            w: rect.width + 8, // slight padding
            h: rect.height + 8,
            r: rawRadius + 4,
          };
        } else {
          setIsMagnetic(false);
          hoverTargetRef.current = null;
        }
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const interactive = target.closest(
        'a, button, select, input[type="submit"], input[type="button"], [role="button"], .interactive-hover, .cursor-pointer, [class*="cursor-pointer"], .provider-pill, .stat-num'
      );

      if (interactive) {
        // Check if we are exiting to another element inside the same interactive target
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (relatedTarget && interactive.contains(relatedTarget)) {
          return;
        }
        setIsHovered(false);
        setIsMagnetic(false);
        hoverTargetRef.current = null;
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('mouseout', handleMouseOut);

    // 2. Animation loop using requestAnimationFrame (60 FPS)
    let animationFrameId: number;

    const tick = () => {
      const mouse = mouseRef.current;
      const ring = ringRef.current;
      const hasReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Targets depending on current state
      let targetX = mouse.x;
      let targetY = mouse.y;
      let targetW = isHovered ? CONFIG.hoverRingSize : CONFIG.idleRingSize;
      let targetH = isHovered ? CONFIG.hoverRingSize : CONFIG.idleRingSize;
      let targetR = isHovered ? 9999 : 9999;

      if (isHovered && isMagnetic && hoverTargetRef.current) {
        const target = hoverTargetRef.current;
        targetX = target.x;
        targetY = target.y;
        targetW = target.w;
        targetH = target.h;
        targetR = target.r;
      }

      // Handle clicking compression sizing
      if (isClicked) {
        targetW *= 0.75;
        targetH *= 0.75;
      }

      // Linear interpolation (lerp) calculations
      const currentLerp = hasReducedMotion 
        ? 1.0 
        : (isMagnetic ? CONFIG.lerpSpeedMagnetic : CONFIG.lerpSpeed);

      ring.x += (targetX - ring.x) * currentLerp;
      ring.y += (targetY - ring.y) * currentLerp;
      ring.w += (targetW - ring.w) * currentLerp;
      ring.h += (targetH - ring.h) * currentLerp;
      ring.r += (targetR - ring.r) * currentLerp;

      // Update inner dot
      if (dotElRef.current) {
        dotElRef.current.style.transform = `translate3d(${mouse.x}px, ${mouse.y}px, 0) translate3d(-50%, -50%, 0)`;
        // Fade out inner dot when wrapping magnetically
        dotElRef.current.style.opacity = isMagnetic ? '0' : isClicked ? '0.7' : '1';
      }

      // Update outer ring
      if (ringElRef.current) {
        ringElRef.current.style.transform = `translate3d(${ring.x}px, ${ring.y}px, 0) translate3d(-50%, -50%, 0)`;
        ringElRef.current.style.width = `${ring.w}px`;
        ringElRef.current.style.height = `${ring.h}px`;
        ringElRef.current.style.borderRadius = `${ring.r}px`;
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('mouseout', handleMouseOut);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isHovered, isMagnetic, isClicked]);

  useEffect(() => {
    if (rippleActive) {
      const timer = setTimeout(() => {
        setRippleActive(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [rippleActive]);

  if (!enabled) return null;

  return (
    <>
      {/* Inner Dot */}
      <div
        ref={dotElRef}
        className="fixed top-0 left-0 pointer-events-none z-[9999] bg-black dark:bg-white rounded-full transition-opacity duration-200"
        style={{
          width: `${CONFIG.idleDotSize}px`,
          height: `${CONFIG.idleDotSize}px`,
        }}
      />

      {/* Outer Ring */}
      <div
        ref={ringElRef}
        className={`fixed top-0 left-0 pointer-events-none z-[9998] rounded-full flex items-center justify-center transition-colors duration-250 ${
          isHovered
            ? 'border-black dark:border-white bg-black/[0.04] dark:bg-white/[0.05] shadow-[0_0_12px_rgba(0,0,0,0.12)] dark:shadow-[0_0_12px_rgba(255,255,255,0.18)]'
            : 'border-black/20 dark:border-white/20 bg-transparent'
        }`}
        style={{
          borderWidth: '2.5px',
          borderStyle: 'solid',
          transitionProperty: 'border-color, background-color, box-shadow, opacity',
        }}
      >
        {/* Satisfying Click Ripple Effect */}
        {rippleActive && (
          <div
            className="absolute rounded-full border border-black/40 dark:border-white/40 animate-ping pointer-events-none"
            style={{
              width: '100%',
              height: '100%',
              animationDuration: '400ms',
              borderWidth: '2.5px',
            }}
          />
        )}
      </div>
    </>
  );
}
