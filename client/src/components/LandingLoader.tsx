import { useEffect, useState } from 'react'
import logoDark from '../assets/logo-dark-theme.webp'
import logoLight from '../assets/logo-light-theme.webp'
import { useTheme } from '@/lib/useTheme'

interface LandingLoaderProps {
  isLoading: boolean
  progress: number
  statusMessage: string
  onTransitionEnd?: () => void
}

export function LandingLoader({
  isLoading,
  progress,
  statusMessage,
  onTransitionEnd,
}: LandingLoaderProps) {
  const isDark = useTheme()
  const [shouldRender, setShouldRender] = useState(true)
  const [isFadingOut, setIsFadingOut] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setIsFadingOut(true)
      const timer = setTimeout(() => {
        setShouldRender(false)
        onTransitionEnd?.()
      }, 600) // matches transition duration
      return () => clearTimeout(timer)
    } else {
      setShouldRender(true)
      setIsFadingOut(false)
    }
  }, [isLoading, onTransitionEnd])

  if (!shouldRender) return null

  const currentLogo = isDark ? logoDark : logoLight

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center select-none transition-all duration-600 ease-out ${
        isDark
          ? 'bg-black text-slate-100'
          : 'bg-slate-50 text-slate-900'
      } ${
        isFadingOut ? 'opacity-0 scale-[1.02] pointer-events-none' : 'opacity-100 scale-100'
      }`}
      aria-busy={isLoading}
      aria-live="polite"
    >
      {/* Background Subtle Radial Glow & Grid pattern */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-30 transition-colors duration-500 ${
            isDark ? 'bg-purple-600/30' : 'bg-purple-400/25'
          }`}
        />
        <div
          className={`absolute inset-0 opacity-[0.03] ${
            isDark ? 'bg-[radial-gradient(#fff_1px,transparent_1px)]' : 'bg-[radial-gradient(#000_1px,transparent_1px)]'
          } [background-size:24px_24px]`}
        />
      </div>

      {/* Main Loader Content Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        {/* Logo Container with Orbital Cybernetic Ring */}
        <div className="relative flex items-center justify-center w-36 h-36 mb-8">
          {/* Outer Rotating Dotted Orbital Ring */}
          <div
            className={`absolute inset-0 rounded-full border border-dashed animate-[spin_12s_linear_infinite] ${
              isDark ? 'border-purple-500/30' : 'border-purple-600/30'
            }`}
          />

          {/* Inner Counter-Rotating Pulsing Ring */}
          <div
            className={`absolute inset-2 rounded-full border border-purple-500/20 animate-[spin_8s_linear_infinite_reverse] ${
              isDark ? 'shadow-[0_0_25px_rgba(168,85,247,0.15)]' : 'shadow-[0_0_20px_rgba(147,51,234,0.1)]'
            }`}
          />

          {/* Glow Backdrop Behind Logo */}
          <div
            className={`absolute inset-4 rounded-full blur-xl animate-pulse ${
              isDark ? 'bg-purple-500/20' : 'bg-purple-600/15'
            }`}
          />

          {/* OmniKey AI Logo */}
          <img
            src={currentLogo}
            alt="OmniKey AI Logo"
            className="relative z-10 w-24 h-auto drop-shadow-md transition-transform duration-300 hover:scale-105"
          />
        </div>

        {/* Dynamic Technical Status Message */}
        <div className="h-7 mb-4 flex items-center justify-center">
          <p
            key={statusMessage}
            className={`text-sm font-medium tracking-wide animate-[fadeSlideUp_0.3s_ease_both] ${
              isDark ? 'text-slate-300' : 'text-slate-700'
            }`}
          >
            {statusMessage}
          </p>
        </div>

        {/* Progress Bar Container */}
        <div className="w-64 sm:w-72 mb-3">
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden p-[1px] ${
              isDark ? 'bg-slate-800/80 border border-slate-700/50' : 'bg-slate-200 border border-slate-300/60'
            }`}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(139,92,246,0.5)]"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        {/* Percentage Counter & Telemetry Label */}
        <div className="flex items-center justify-between w-64 sm:w-72 text-[11px] font-mono tracking-wider">
          <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>
            SYS_BOOT // {Math.round(progress)}%
          </span>
          <span className={isDark ? 'text-purple-400/90 font-semibold' : 'text-purple-600 font-semibold'}>
            {progress >= 100 ? 'READY' : 'INITIALIZING'}
          </span>
        </div>
      </div>

      {/* Footer System Status Tag */}
      <div className="absolute bottom-6 text-[10px] font-mono tracking-widest uppercase opacity-40">
        OmniKey AI Gateway Runtime
      </div>
    </div>
  )
}
