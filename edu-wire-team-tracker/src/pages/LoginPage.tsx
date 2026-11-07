import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'
import eduwireLogo from '@/assets/eduwire-logo.png'
import eduwireLogoDark from '@/assets/eduwire-logo-dark.jpg'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { Card, CardContent } from '@/components/ui/Card'
import MagicRings from '@/components/ui/MagicRings'
import { cn } from '@/lib/utils/cn'

export function LoginPage() {
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('eduwire_theme') === 'dark'
  })

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev
      localStorage.setItem('eduwire_theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <div
      className={cn(
        'relative min-h-screen w-full flex flex-col justify-center items-center px-4 py-8 sm:px-6 lg:px-8 overflow-hidden select-none transition-colors duration-300',
        isDark ? 'bg-[#090D16]' : 'bg-page',
      )}
    >
      {/* Top Header Bar: Logo on Top-Left, Theme Toggle on Top-Right */}
      <header className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center px-6 py-5 sm:px-8">
        <img
          src={isDark ? eduwireLogoDark : eduwireLogo}
          alt="Edu Wire Team Tracker"
          className={cn(
            'h-8 sm:h-9 w-auto max-w-[170px] object-contain drop-shadow-xs transition-opacity duration-200',
            isDark && 'mix-blend-screen',
          )}
        />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className={cn(
            'inline-flex items-center justify-center p-2.5 rounded-full border transition-all duration-200 cursor-pointer shadow-sm',
            isDark
              ? 'bg-slate-800/80 border-slate-700 text-amber-300 hover:bg-slate-700 hover:text-amber-200 focus-visible:ring-2 focus-visible:ring-brand-blue/40'
              : 'bg-white/80 border-border-subtle text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-brand-blue/30',
          )}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </header>

      {/* Interactive MagicRings WebGL Background (Dimmed glow, delicate lines, calm motion) */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <MagicRings
          key={isDark ? 'dark' : 'light'}
          color={isDark ? '#3B82F6' : '#4F46E5'}
          colorTwo={isDark ? '#6366F1' : '#0284C7'}
          motion="pulse"
          ringCount={6}
          speed={0.5}
          lineThickness={1.1}
          glow={0.25}
          hoverScale={1.1}
          clickBurst
          baseRadius={0.35}
          radiusStep={0.1}
          expansion={0.08}
          taper={1.5}
          rotation={0}
          spin={0}
          tilt={0}
          dispersion={0}
          grain={0}
          opacity={isDark ? 0.65 : 0.6}
          followMouse={false}
          mouseInfluence={0.2}
          hoverIntensity={0.6}
          parallax={0.05}
          intro
          theme={isDark ? 'dark' : 'light'}
        />
      </div>

      {/* Main Authentication Card */}
      <Card
        className={cn(
          'relative z-10 w-full max-w-md rounded-card backdrop-blur-md transition-colors duration-300',
          isDark
            ? 'bg-slate-900/85 border border-slate-800 shadow-2xl text-slate-100'
            : 'bg-surface/90 border border-border-subtle shadow-card text-text-primary',
        )}
      >
        <CardContent className="p-7 sm:p-8">
          {/* Card Title & Subtitle */}
          <div className="text-center mb-6">
            <h1
              className={cn(
                'text-2xl font-bold tracking-tight',
                isDark ? 'text-white' : 'text-text-primary',
              )}
            >
              Sign In
            </h1>
            <p
              className={cn(
                'text-sm mt-1.5',
                isDark ? 'text-slate-400' : 'text-text-muted',
              )}
            >
              Enter your credentials to access your account
            </p>
          </div>

          <LoginForm isDark={isDark} />
        </CardContent>
      </Card>
    </div>
  )
}
