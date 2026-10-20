import React, { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import { useApp } from "../context/AppContext"
import { authService } from "../services/authService"
import { otpService } from "../services/otpService"
import { OTPInput } from "../components/OTPInput"
import { PrimaryButton } from "../components/PrimaryButton"
import { CheckIcon, ChevronLeftIcon, RotateCwIcon } from "../components/Icons"

export const OTPScreen: React.FC = () => {
  const { register } = useAuth()
  const { setScreen, notify, registrationDraft, setRegistrationDraft } = useApp()

  const [code, setCode] = useState("")
  const [countdown, setCountdown] = useState(300)
  const [isExpired, setIsExpired] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [registrationToken, setRegistrationToken] = useState<string | null>(null)

  // Match the server's five-minute registration OTP lifetime.
  useEffect(() => {
    if (countdown <= 0) {
      setIsExpired(true)
      return
    }
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const handleVerify = async () => {
    setError("")

    if (!registrationDraft) {
      setError("No verification request is active. Return to the previous screen and try again.")
      return
    }

    if (!registrationToken && code.length !== 6) {
      setError("Please enter the complete 6-digit verification code.")
      return
    }

    if (!registrationToken && isExpired) {
      setError("This code has expired. Please click Resend Code.")
      return
    }

    setIsVerifying(true)

    try {
      let verifiedToken = registrationToken
      if (!verifiedToken) {
        const verifyRes = await authService.verifyRegistrationOtp(registrationDraft.email, code)
        if (!verifyRes.success || !verifyRes.registrationToken) {
          setError(verifyRes.error || "Incorrect or expired verification code.")
          return
        }
        verifiedToken = verifyRes.registrationToken
        setRegistrationToken(verifiedToken)
      }

      const result = await register(
        registrationDraft.name,
        registrationDraft.email,
        registrationDraft.phone,
        registrationDraft.password,
        verifiedToken,
      )
      if (!result.success) {
        setError(result.error || "Could not complete account registration.")
        return
      }

      setSuccess(true)
      setRegistrationDraft(null)
      notify("Email verified and account created successfully!")
      setTimeout(() => setScreen("home"), 800)
    } catch (e: any) {
      setError(e?.message || "Verification failed.")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!registrationDraft) {
      setError("No active registration was found. Return to registration and try again.")
      return
    }

    const result = await authService.requestRegistrationOtp(registrationDraft.email)
    if (!result.success) {
      setError(result.error || "Could not send a new registration verification code.")
      return
    }
    setRegistrationToken(null)
    setCountdown(300)
    setIsExpired(false)
    setCode("")
    setError("")
    notify("If this email can be registered, a new verification code will be sent.")
  }

  const maskedEmail = registrationDraft
    ? otpService.maskEmail(registrationDraft.email)
    : "u***@example.com"
  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-main)]">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-xl space-y-6">
        {/* Back Link */}
        <button
          type="button"
          onClick={() => setScreen(registrationDraft ? "register" : "login")}
          className="inline-flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--color-primary)] cursor-pointer"
        >
          <ChevronLeftIcon size={16} />
          <span>Change details</span>
        </button>

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--surface-soft-blue)] border border-[var(--color-primary)]/20 text-[var(--color-primary)] flex items-center justify-center font-bold text-xl shadow-sm">
            6
          </div>
          <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
            Verify Your Identity
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
            Enter the 6-digit verification code associated with:
          </p>

          {/* Masked destination badges */}
          <div className="p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-1 font-mono text-xs text-[var(--text-main)] font-semibold">
            <div className="text-[var(--color-primary)]">{maskedEmail}</div>
          </div>
        </div>

        {/* 6-box OTP Input */}
        <div className="space-y-4">
          <OTPInput
            value={code}
            onChange={(val) => {
              setCode(val)
              setError("")
            }}
            error={Boolean(error)}
            disabled={isVerifying || success}
          />

          {error && (
            <p className="text-xs text-center font-semibold text-[var(--color-emergency)]">
              {error}
            </p>
          )}

          {success && (
            <div className="p-3 rounded-xl bg-[var(--color-success-surface)] text-[var(--color-success)] text-xs font-bold flex items-center justify-center gap-2">
              <CheckIcon size={16} color="currentColor" />
              <span>Verification successful! Completing setup...</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <PrimaryButton
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleVerify}
            disabled={(!registrationToken && code.length !== 6) || isVerifying || success || !registrationDraft}
          >
            {isVerifying
              ? registrationToken ? "Creating account..." : "Verifying code..."
              : registrationToken ? "Complete registration" : "Verify Code"}
          </PrimaryButton>

          {/* Timer & Resend */}
          <div className="flex items-center justify-center text-xs text-[var(--text-secondary)]">
            {!isExpired ? (
              <span>Resend code in {countdown}s</span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="inline-flex items-center gap-1.5 font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
              >
                <RotateCwIcon size={14} />
                <span>Resend Code</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
