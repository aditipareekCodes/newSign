import React, { useState } from "react"
import { useApp } from "../context/AppContext"
import { authService } from "../services/authService"
import { HandIcon, EyeIcon, ChevronLeftIcon } from "../components/Icons"
import { PrimaryButton } from "../components/PrimaryButton"
import { ThemeSwitcher } from "../components/ThemeSwitcher"

export const RegisterScreen: React.FC = () => {
  const { setScreen, notify, registrationDraft, setRegistrationDraft } = useApp()

  const [name, setName] = useState(registrationDraft?.name || "")
  const [email, setEmail] = useState(registrationDraft?.email || "")
  const [phone, setPhone] = useState(registrationDraft?.phone || "")
  const [password, setPassword] = useState(registrationDraft?.password || "")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!name.trim()) {
      setError("Please enter your full name.")
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("Please enter a valid email address.")
      return
    }

    const cleanPhone = phone.replace(/\D/g, "")
    if (cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit mobile number.")
      return
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    if (!agreeTerms) {
      setError("You must accept the Terms and Privacy Policy to register.")
      return
    }

    setIsSubmitting(true)
    try {
      const cleanDraft = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password,
      }
      const result = await authService.requestRegistrationOtp(cleanDraft.email)
      if (!result.success) {
        setError(result.error || "Could not request a registration verification code.")
        return
      }

      setRegistrationDraft(cleanDraft)
      notify(result.message || "Check your email for the registration verification code.")
      setScreen("otp")
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not request a registration verification code.",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex bg-[var(--bg-main)]">
      {/* Visual Side (Desktop) */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-12 bg-gradient-to-br from-[var(--color-primary-deep)] via-[#1B2850] to-[var(--bg-main)] text-white relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-lg">
            <HandIcon size={26} color="white" />
          </div>
          <span className="font-extrabold text-xl tracking-tight">SignVaani</span>
        </div>

        <div className="my-auto py-8 relative z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-aqua)]/20 border border-[var(--color-aqua)]/30 text-xs font-semibold text-[var(--color-aqua)] mb-6">
            <span>Gesture Flow Accessibility</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight">
            Empower Voice Through Expressive Motion
          </h2>
          <p className="text-sm text-white/75 mt-4 leading-relaxed">
            Create an account to personalize your ISL gestures, store custom multilingual phrases, and seamlessly communicate in English, Hindi, and Marathi.
          </p>
        </div>

        <div className="text-xs text-white/60 relative z-10">
          SignVaani Assistive Communication Framework
        </div>
      </div>

      {/* Form Side */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-14 max-w-xl mx-auto w-full overflow-y-auto">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              setRegistrationDraft(null)
              setScreen("login")
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--color-primary)] cursor-pointer"
          >
            <ChevronLeftIcon size={16} />
            <span>Back to login</span>
          </button>
          <ThemeSwitcher variant="compact" />
        </div>

        <div className="my-auto py-6">
          <div className="space-y-1.5 mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)]">
              Create your account
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              We'll send a verification code to your email.
            </p>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-xl bg-[var(--color-emergency-surface)] border border-[var(--color-emergency-border)] text-[var(--color-emergency)] text-xs font-semibold">
                {error}
              </div>
            )}

            {/* Full Name */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Aditya Sharma"
                className="input-field"
              />
            </div>

            {/* Email Address */}
            <div className="space-y-1">
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

            {/* Phone Number */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Phone Number
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="input-field"
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
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

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Confirm Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-type password"
                className="input-field"
              />
            </div>

            {/* Terms & Privacy */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded text-[var(--color-primary)] focus:ring-[var(--color-primary)] border-[var(--border-color)] cursor-pointer"
                />
                <span className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  I agree to the <span className="font-semibold text-[var(--color-primary)]">Terms of Service</span> and <span className="font-semibold text-[var(--color-primary)]">Privacy Policy</span>.
                </span>
              </label>
            </div>

            {/* Submit */}
            <div className="pt-2">
              <PrimaryButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending verification code..." : "Continue to verification"}
              </PrimaryButton>
            </div>
          </form>
        </div>

        <div className="text-center pt-4 border-t border-[var(--border-subtle)] text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <button
            type="button"
            onClick={() => {
              setRegistrationDraft(null)
              setScreen("login")
            }}
            className="font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  )
}
