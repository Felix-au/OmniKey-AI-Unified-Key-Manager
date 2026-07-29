"use client";

import { useEffect, useRef, useState, memo } from "react";
import { motion } from "motion/react";
import type React from "react";

type GradientDotsProps = React.ComponentProps<typeof motion.div> & {
	/** Dot size (default: 8) */
	dotSize?: number;
	/** Dot radius for rendering (default: 1.5) */
	dotRadius?: number;
	/** Spacing between dots (default: 20) */
	spacing?: number;
	/** Animation duration of background gradients (default: 30) */
	duration?: number;
	/** Color cycle duration of gradients (default: 6) */
	colorCycleDuration?: number;
	/** Background color (default: 'var(--background)') */
	backgroundColor?: string;
	/** Cursor interaction area radius (default: 120) */
	cursorRadius?: number;
	/** Physics push force multiplier (default: 0.1) */
	cursorForce?: number;
	/** Bulge dots away from cursor instead of physics flow (default: true) */
	bulgeOnly?: boolean;
	/** Intensity of the cursor bulge displacement (default: 40) */
	bulgeStrength?: number;
	/** Sparkle effect for a small percentage of dots (default: false) */
	sparkle?: boolean;
	/** Continuous wave displacement amplitude (default: 0) */
	waveAmplitude?: number;
	/** Require mouse movement for bulging (default: true) */
	requireMotion?: boolean;
};

interface Dot {
	ax: number;
	ay: number;
	sx: number;
	sy: number;
	vx: number;
	vy: number;
	x: number;
	y: number;
}

const TWO_PI = Math.PI * 2;

export const GradientDots = memo(({
	dotRadius = 1.5,
	dotSize = 8, // Kept for backwards compatibility
	spacing = 20,
	duration = 30,
	colorCycleDuration = 6,
	backgroundColor = "var(--background)",
	cursorRadius = 120,
	cursorForce = 0.1,
	bulgeOnly = true,
	bulgeStrength = 40,
	sparkle = false,
	waveAmplitude = 0,
	requireMotion = true,
	className,
	style,
	...props
}: GradientDotsProps) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const dotsRef = useRef<Dot[]>([]);
	const mouseRef = useRef({ x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 });
	const rafRef = useRef<number | null>(null);
	const sizeRef = useRef({ w: 0, h: 0, offsetX: 0, offsetY: 0 });
	const engagement = useRef(0);
	const resolvedBgRef = useRef("rgb(11, 9, 15)");

	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const checkMobile = () => {
			setIsMobile(window.innerWidth < 768);
		};
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	const propsRef = useRef({
		dotRadius,
		spacing,
		cursorRadius,
		cursorForce,
		bulgeOnly,
		bulgeStrength,
		sparkle,
		waveAmplitude,
		requireMotion,
		backgroundColor,
	});

	propsRef.current = {
		dotRadius,
		spacing,
		cursorRadius,
		cursorForce,
		bulgeOnly,
		bulgeStrength,
		sparkle,
		waveAmplitude,
		requireMotion,
		backgroundColor,
	};

	const hexSpacing = spacing * 1.732; // Hexagonal spacing calculation

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d", { alpha: true });
		if (!ctx) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		let resizeTimer: number;

		const canvasEl = canvas;
		const canvasCtx = ctx;

		function resize() {
			window.clearTimeout(resizeTimer);
			resizeTimer = window.setTimeout(doResize, 100);
		}

		function resolveBgColor() {
			const propBg = propsRef.current.backgroundColor;
			if (propBg.startsWith("var(")) {
				const varName = propBg.substring(4, propBg.length - 1);
				const resolved = getComputedStyle(canvasEl).getPropertyValue(varName).trim();
				resolvedBgRef.current = resolved || "rgb(11, 9, 15)";
			} else {
				resolvedBgRef.current = propBg;
			}
		}

		function doResize() {
			const rect = canvasEl.parentElement?.getBoundingClientRect();
			if (!rect) return;
			const w = rect.width;
			const h = rect.height;

			canvasEl.width = w * dpr;
			canvasEl.height = h * dpr;
			canvasEl.style.width = `${w}px`;
			canvasEl.style.height = `${h}px`;
			canvasCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

			sizeRef.current = {
				w,
				h,
				offsetX: rect.left + window.scrollX,
				offsetY: rect.top + window.scrollY,
			};

			resolveBgColor();
			buildDots(w, h);
		}

		function buildDots(w: number, h: number) {
			const p = propsRef.current;
			const stepX = p.spacing;
			const stepY = p.spacing * 1.732;

			// Add bounds padding to ensure no gaps at boundaries when pushed
			const pad = 20;
			const cols = Math.ceil((w + pad * 2) / stepX) + 1;
			const rows = Math.ceil((h + pad * 2) / stepY) + 1;
			const dots: Dot[] = [];

			for (let row = -1; row < rows; row++) {
				for (let col = -1; col < cols; col++) {
					// Grid A (offset 0, 0 relative to padding)
					const ax1 = -pad + col * stepX;
					const ay1 = -pad + row * stepY;
					dots.push({ ax: ax1, ay: ay1, sx: ax1, sy: ay1, vx: 0, vy: 0, x: ax1, y: ay1 });

					// Grid B (offset stepX / 2, stepY / 2 relative to padding)
					const ax2 = -pad + col * stepX + stepX / 2;
					const ay2 = -pad + row * stepY + stepY / 2;
					dots.push({ ax: ax2, ay: ay2, sx: ax2, sy: ay2, vx: 0, vy: 0, x: ax2, y: ay2 });
				}
			}
			dotsRef.current = dots;
		}

		function onMouseMove(e: MouseEvent) {
			const s = sizeRef.current;
			const m = mouseRef.current;
			const x = e.pageX - s.offsetX;
			const y = e.pageY - s.offsetY;

			if (m.x === -9999) {
				m.prevX = x;
				m.prevY = y;
			}
			m.x = x;
			m.y = y;
		}

		function updateMouseSpeed() {
			const m = mouseRef.current;
			if (m.x === -9999) return;
			const dx = m.prevX - m.x;
			const dy = m.prevY - m.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			m.speed += (dist - m.speed) * 0.5;
			if (m.speed < 0.001) m.speed = 0;
			m.prevX = m.x;
			m.prevY = m.y;
		}

		const speedInterval = setInterval(updateMouseSpeed, 20);
		let frameCount = 0;

		function tick() {
			frameCount++;
			const dots = dotsRef.current;
			const m = mouseRef.current;
			const { w, h } = sizeRef.current;
			const p = propsRef.current;
			const len = dots.length;
			const t = frameCount * 0.02;

			let eng = 1.0;
			if (p.requireMotion) {
				const targetEngagement = Math.min(m.speed / 5, 1);
				engagement.current += (targetEngagement - engagement.current) * 0.06;
				if (engagement.current < 0.001) engagement.current = 0;
				eng = engagement.current;
			}

			canvasCtx.clearRect(0, 0, w, h);

			// Fill solid background color
			canvasCtx.fillStyle = resolvedBgRef.current;
			canvasCtx.fillRect(0, 0, w, h);

			// Use destination-out to cut transparent holes for the dot grid
			canvasCtx.globalCompositeOperation = "destination-out";
			canvasCtx.fillStyle = "#000";

			const cr = p.cursorRadius;
			const crSq = cr * cr;
			const rad = p.dotRadius;
			const isBulge = p.bulgeOnly;

			canvasCtx.beginPath();

			for (let i = 0; i < len; i++) {
				const d = dots[i];
				const dx = m.x - d.ax;
				const dy = m.y - d.ay;
				const distSq = dx * dx + dy * dy;

				if (distSq < crSq && eng > 0.01) {
					const dist = Math.sqrt(distSq);
					if (isBulge) {
						const pct = 1 - dist / cr;
						const push = pct * pct * p.bulgeStrength * eng;
						const angle = Math.atan2(dy, dx);
						d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.15;
						d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.15;
					} else {
						const angle = Math.atan2(dy, dx);
						const move = (500 / dist) * (m.speed * p.cursorForce);
						d.vx += Math.cos(angle) * -move;
						d.vy += Math.sin(angle) * -move;
					}
				} else if (isBulge) {
					d.sx += (d.ax - d.sx) * 0.1;
					d.sy += (d.ay - d.sy) * 0.1;
				}

				if (!isBulge) {
					d.vx *= 0.9;
					d.vy *= 0.9;
					d.x = d.ax + d.vx;
					d.y = d.ay + d.vy;
					d.sx += (d.x - d.sx) * 0.1;
					d.sy += (d.y - d.sy) * 0.1;
				}

				let drawX = d.sx;
				let drawY = d.sy;
				if (p.waveAmplitude > 0) {
					drawY += Math.sin(d.ax * 0.03 + t) * p.waveAmplitude;
					drawX += Math.cos(d.ay * 0.03 + t * 0.7) * p.waveAmplitude * 0.5;
				}

				if (p.sparkle) {
					const hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
					if ((hash % 100) < 3) {
						canvasCtx.moveTo(drawX + rad * 1.8, drawY);
						canvasCtx.arc(drawX, drawY, rad * 1.8, 0, TWO_PI);
					} else {
						canvasCtx.moveTo(drawX + rad, drawY);
						canvasCtx.arc(drawX, drawY, rad, 0, TWO_PI);
					}
				} else {
					canvasCtx.moveTo(drawX + rad, drawY);
					canvasCtx.arc(drawX, drawY, rad, 0, TWO_PI);
				}
			}

			canvasCtx.fill();

			// Reset standard composite operation
			canvasCtx.globalCompositeOperation = "source-over";

			rafRef.current = requestAnimationFrame(tick);
		}

		doResize();
		window.addEventListener("resize", resize);
		window.addEventListener("mousemove", onMouseMove, { passive: true });
		rafRef.current = requestAnimationFrame(tick);

		// Observe theme changes (classes on <html>) to re-resolve CSS background variable
		const observer = new MutationObserver(() => {
			resolveBgColor();
		});
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			clearInterval(speedInterval);
			window.clearTimeout(resizeTimer);
			window.removeEventListener("resize", resize);
			window.removeEventListener("mousemove", onMouseMove);
			observer.disconnect();
		};
	}, []);

	if (isMobile) {
		return (
			<motion.div
				className={`absolute inset-0 ${className}`}
				style={{
					backgroundColor,
					backgroundImage: `
            radial-gradient(circle at 50% 50%, transparent 1.5px, ${backgroundColor} 0 ${dotSize}px, transparent ${dotSize}px),
            radial-gradient(circle at 50% 50%, transparent 1.5px, ${backgroundColor} 0 ${dotSize}px, transparent ${dotSize}px),
            radial-gradient(circle at 50% 50%, #f00, transparent 60%),
            radial-gradient(circle at 50% 50%, #ff0, transparent 60%),
            radial-gradient(circle at 50% 50%, #0f0, transparent 60%),
            radial-gradient(ellipse at 50% 50%, #00f, transparent 60%)
          `,
					backgroundSize: `
            ${spacing}px ${hexSpacing}px,
            ${spacing}px ${hexSpacing}px,
            200% 200%,
            200% 200%,
            200% 200%,
            200% ${hexSpacing}px
          `,
					backgroundPosition: `
            0px 0px, ${spacing / 2}px ${hexSpacing / 2}px,
            0% 0%,
            0% 0%,
            0% 0px
          `,
					...style,
				}}
				animate={{
					backgroundPosition: [
						`0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 800% 400%, 1000% -400%, -1200% -600%, 400% ${hexSpacing}px`,
						`0px 0px, ${spacing / 2}px ${hexSpacing / 2}px, 0% 0%, 0% 0%, 0% 0%, 0% 0%`,
					],
					filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"],
				}}
				transition={{
					backgroundPosition: {
						duration: duration,
						ease: "linear",
						repeat: Number.POSITIVE_INFINITY,
					},
					filter: {
						duration: colorCycleDuration,
						ease: "linear",
						repeat: Number.POSITIVE_INFINITY,
					},
				}}
				{...props}
			/>
		);
	}

	return (
		<motion.div
			className={`absolute inset-0 overflow-hidden ${className}`}
			style={{ backgroundColor, ...style }}
			{...props}
		>
			<motion.div
				className="absolute inset-0 pointer-events-none"
				style={{
					backgroundImage: `
            radial-gradient(circle at 50% 50%, #f00, transparent 60%),
            radial-gradient(circle at 50% 50%, #ff0, transparent 60%),
            radial-gradient(circle at 50% 50%, #0f0, transparent 60%),
            radial-gradient(ellipse at 50% 50%, #00f, transparent 60%)
          `,
					backgroundSize: `
            200% 200%,
            200% 200%,
            200% 200%,
            200% ${hexSpacing}px
          `,
					backgroundPosition: `
            0% 0%,
            0% 0%,
            0% 0%,
            0% 0px
          `,
				}}
				animate={{
					backgroundPosition: [
						`800% 400%, 1000% -400%, -1200% -600%, 400% ${hexSpacing}px`,
						`0% 0%, 0% 0%, 0% 0%, 0% 0%`,
					],
					filter: ["hue-rotate(0deg)", "hue-rotate(360deg)"],
				}}
				transition={{
					backgroundPosition: {
						duration: duration,
						ease: "linear",
						repeat: Number.POSITIVE_INFINITY,
					},
					filter: {
						duration: colorCycleDuration,
						ease: "linear",
						repeat: Number.POSITIVE_INFINITY,
					},
				}}
			/>
			<canvas
				ref={canvasRef}
				style={{
					position: "absolute",
					inset: 0,
					width: "100%",
					height: "100%",
					pointerEvents: "none",
				}}
			/>
		</motion.div>
	);
});

GradientDots.displayName = "GradientDots";
