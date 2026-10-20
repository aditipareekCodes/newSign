import React, { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useApp } from "../context/AppContext"
import { HandIcon, EyeIcon, WaveformIcon, CheckIcon } from "../components/Icons"
import { PrimaryButton } from "../components/PrimaryButton"
import { ThemeSwitcher } from "../components/ThemeSwitcher"

export const LoginScreen: React.FC = () => {
  const { login, rememberedEmail } = useAuth()
  const { setScreen, notify } = useApp()

  const [email, setEmail] = useState(rememberedEmail || "")
  const [password, setPassword] = useState("SignVaani@123")
  const [rememberMe, setRememberMe] = useState(Boolean(rememberedEmail))
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (rememberedEmail) {
      setEmail(rememberedEmail)
      setRememberMe(true)
    }
  }, [rememberedEmail])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!email.trim() || !password) {
      setError("Please provide both email and password.")
      return
    }

    setLoading(true)
    try {
      const res = await login(email, password, rememberMe)
      if (res.success) {
        notify("Welcome back to SignVaani")
        setScreen("home")
      } else {
        setError(res.error || "Invalid credentials.")
      }
    } catch {
      setError("An unexpected error occurred during sign in.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex bg-[var(--bg-main)]">
      {/* Visual Artistic Side (Desktop) */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-[var(--color-primary)] via-[var(--color-primary-deep)] to-[#151D42] text-white relative overflow-hidden">
        {/* Floating gesture waves & sound paths */}
        <div className="absolute -right-20 -top-20 w-96 h-96 rounded-full bg-[var(--color-aqua)]/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-96 h-96 rounded-full bg-[var(--color-lavender)]/20 blur-3xl pointer-events-none" />

        {/* Top brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
            <HandIcon size={26} color="white" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight">SignVaani</span>
            <span className="block text-xs text-white/70 font-medium">Gesture Flow System</span>
          </div>
        </div>

        {/* Center illustration: Abstract hand gesture line art & sound-wave trails */}
        <div className="relative z-10 my-auto py-12 flex flex-col items-center text-center">
          <div className="relative w-64 h-64 mb-8 flex items-center justify-center">
            {/* Concentric sound wave circles */}
            <div className="absolute inset-0 rounded-full border border-white/10 animate-ping opacity-25" />
            <div className="absolute inset-6 rounded-full border border-white/20 animate-pulse" />
            <div className="absolute inset-14 rounded-full border border-[var(--color-aqua)]/30" />

            {/* Glowing gesture center */}
            <div className="w-28 h-28 rounded-3xl bg-white/10 backdrop-blur-xl border border-white/30 flex items-center justify-center shadow-2xl shadow-indigo-900/50 transform rotate-6 hover:rotate-0 transition-transform">
              <HandIcon size={56} color="white" />
            </div>

            {/* Motion trail badge */}
            <div className="absolute -bottom-2 left-6 px-3 py-1 rounded-full bg-[var(--color-aqua)]/20 backdrop-blur-md border border-[var(--color-aqua)]/40 text-xs font-semibold text-white flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--color-aqua)] animate-pulse" />
              Continuous Recognition
            </div>
          </div>

          <h2 className="text-3xl font-extrabold tracking-tight max-w-md">
            Bridging Silence and Sound Through AI
          </h2>
          <p className="text-sm text-white/75 mt-3 max-w-sm leading-relaxed">
            Real-time Indian Sign Language recognition translated seamlessly into Hindi, Marathi, and natural speech.
          </p>
        </div>

        {/* Bottom footer quote */}
        <div className="flex items-center justify-between text-xs text-white/60 relative z-10 border-t border-white/10 pt-6">
          <span>College Assistive Technology Project</span>
          <span>Web Speech & Vision API</span>
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 max-w-xl mx-auto w-full">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-primary)] text-white flex items-center justify-center shadow-md">
              <HandIcon size={20} color="white" />
            </div>
            <span className="font-bold text-lg text-[var(--text-main)]">SignVaani</span>
          </div>
          <div className="ml-auto">
            <ThemeSwitcher variant="compact" />
          </div>
        </div>

        {/* Main Login Form */}
        <div className="my-auto py-8">
          <div className="space-y-2 mb-8">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
              Welcome back
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">
              Sign in with your email to start gesture communication.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3.5 rounded-xl bg-[var(--color-emergency-surface)] border border-[var(--color-emergency-border)] text-[var(--color-emergency)] text-xs font-semibold flex items-center gap-2">
                <span>{error}</span>
              </div>
            )}

            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="input-field"
              />
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setScreen("forgot-password")}
                  className="text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="input-field pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon size={18} />
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--border-color)] cursor-pointer"
                />
                <span className="text-sm text-[var(--text-secondary)]">Remember me</span>
              </label>
            </div>

            {/* Submit */}
            <PrimaryButton
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={loading}
            >
              {loading ? "Signing in..." : "Log in"}
            </PrimaryButton>
          </form>

          {/* Demo helper */}
          <div className="mt-6 p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
            <span className="font-bold text-[var(--text-main)]">Demo Credentials: </span>
            <span>demo@signvaani.com / SignVaani@123</span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pt-4 border-t border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
          Don't have an account?{" "}
          <button
            type="button"
            onClick={() => setScreen("register")}
            className="font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            Create account
          </button>
        </div>
      </div>
    </div>
  )
}
