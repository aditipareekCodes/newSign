import React, { useState } from "react"
import { useApp } from "../context/AppContext"
import { authService } from "../services/authService"
import { OTPInput } from "../components/OTPInput"
import { PrimaryButton } from "../components/PrimaryButton"
import { ChevronLeftIcon, CheckIcon, EyeIcon, AlertIcon } from "../components/Icons"

export const ForgotPasswordScreen: React.FC = () => {
  const { setScreen, notify } = useApp()

  const [step, setStep] = useState<"identify" | "otp" | "reset" | "done">("identify")
  const [identifier, setIdentifier] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [resetToken, setResetToken] = useState("")
  const [deliveryStatus, setDeliveryStatus] = useState<string>("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!identifier.trim()) {
      setError("Please enter your registered email or phone number.")
      return
    }

    setLoading(true)
    try {
      const res = await authService.requestPasswordReset(identifier)
      if (res.success) {
        setDeliveryStatus(res.deliveryStatus)
        setStep("otp")
        notify(`Verification code dispatched to ${identifier}.`)
      } else {
        setError(res.message || "No account found matching this identifier.")
      }
    } catch {
      setError("Failed to connect to the authentication service.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError("")
    if (otpCode.length !== 6) {
      setError("Please enter the complete 6-digit verification code.")
      return
    }

    setLoading(true)
    try {
      const res = await authService.verifyPasswordResetOtp(identifier, otpCode)
      if (res.success && res.resetToken) {
        setResetToken(res.resetToken)
        setStep("reset")
      } else {
        setError(res.message || "Incorrect or expired verification code.")
      }
    } catch {
      setError("Failed to verify code.")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.")
      return
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      const res = await authService.resetPasswordWithToken(resetToken, newPassword)
      if (res.success) {
        setStep("done")
        notify("Password updated successfully!")
      } else {
        setError(res.message || "Could not update password for this account.")
      }
    } catch {
      setError("Failed to reset password.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 sm:p-6 bg-[var(--bg-main)]">
      <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-xl space-y-6">
        <button
          type="button"
          onClick={() => setScreen("login")}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-secondary)] hover:text-[var(--color-primary)] cursor-pointer"
        >
          <ChevronLeftIcon size={16} />
          <span>Return to login</span>
        </button>

        {step === "identify" && (
          <div className="space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
                Reset Password
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Enter your account email or phone to receive a verification code.
              </p>
            </div>

            <form onSubmit={handleIdentify} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[var(--color-emergency-surface)] text-[var(--color-emergency)] text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Email or Phone
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="demo@signvaani.com"
                  className="input-field"
                />
              </div>

              <PrimaryButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading}
              >
                {loading ? "Verifying..." : "Send Verification Code"}
              </PrimaryButton>
            </form>
          </div>
        )}

        {step === "otp" && (
          <div className="space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
                Enter Code
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                {deliveryStatus === "delivered"
                  ? `Enter the 6-digit verification code sent to ${identifier}.`
                  : "Enter the 6-digit verification code sent to your email or phone."}
              </p>
            </div>

            <div className="space-y-4">
              <OTPInput
                value={otpCode}
                onChange={(val) => {
                  setOtpCode(val)
                  setError("")
                }}
                error={Boolean(error)}
              />

              {error && (
                <p className="text-xs text-center font-semibold text-[var(--color-emergency)]">
                  {error}
                </p>
              )}

              <PrimaryButton
                variant="primary"
                size="lg"
                fullWidth
                onClick={handleVerifyOtp}
                disabled={otpCode.length !== 6 || loading}
              >
                {loading ? "Verifying code..." : "Verify & Continue"}
              </PrimaryButton>
            </div>
          </div>
        )}

        {step === "reset" && (
          <div className="space-y-5">
            <div className="space-y-1.5 text-center">
              <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
                Create New Password
              </h1>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                Set a strong password with at least 8 characters.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="p-3 rounded-xl bg-[var(--color-emergency-surface)] text-[var(--color-emergency)] text-xs font-semibold">
                  {error}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="input-field pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 cursor-pointer"
                  >
                    <EyeIcon size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  className="input-field"
                />
              </div>

              <PrimaryButton
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </PrimaryButton>
            </form>
          </div>
        )}

        {step === "done" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-[var(--color-success-surface)] text-[var(--color-success)] flex items-center justify-center">
              <CheckIcon size={28} />
            </div>
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[var(--text-main)]">
                Password Updated!
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Your password has been changed securely. You can now log in with your new credentials.
              </p>
            </div>
            <PrimaryButton
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => setScreen("login")}
            >
              Back to Login
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  )
}
