import { KeyRound, ShieldAlert } from 'lucide-react'
import { ChangePasswordForm } from '@/features/auth/components/ChangePasswordForm'
import { Card, CardContent } from '@/components/ui/Card'
import MagicRings from '@/components/ui/MagicRings'

export function ChangePasswordPage() {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center bg-page px-4 py-8 sm:px-6 lg:px-8 overflow-hidden select-none">
      {/* Interactive MagicRings WebGL Background */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <MagicRings
          color="#A855F7"
          colorTwo="#6366F1"
          motion="pulse"
          ringCount={6}
          speed={1}
          lineThickness={2}
          glow={1}
          hoverScale={1.2}
          clickBurst
          baseRadius={0.35}
          radiusStep={0.1}
          expansion={0.1}
          taper={1.5}
          rotation={0}
          spin={0}
          tilt={0}
          dispersion={0}
          grain={0}
          opacity={1}
          followMouse={false}
          mouseInfluence={0.2}
          hoverIntensity={1}
          parallax={0.05}
          intro
        />
      </div>

      {/* Page Header */}
      <div className="relative z-10 w-full max-w-md mx-auto text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-inner bg-tint-amber-bg text-tint-amber-text border border-tint-amber-border shadow-card mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          Set a New Password
        </h1>
        <p className="text-sm text-text-muted mt-1.5">
          Your account was provisioned with a temporary password. Please set a secure password before proceeding.
        </p>
      </div>

      {/* Main Form Card */}
      <Card className="relative z-10 w-full max-w-md shadow-card border border-border-subtle rounded-card bg-surface/90 backdrop-blur-md">
        <CardContent className="p-7 sm:p-8">
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Security note footer */}
      <div className="relative z-10 mt-8 flex items-center justify-center gap-2 text-xs text-text-muted text-center">
        <ShieldAlert className="w-4 h-4 text-text-muted/70 shrink-0" />
        <span>Mandatory Security Verification • Edu Wire Team Tracker</span>
      </div>
    </div>
  )
}
