import { authService, PasswordResetResponse, VerifyOtpResponse } from "./authService"

export interface OtpSession {
  target: string
  expiresAt: number
  devCode?: string
  deliveryStatus: "delivered" | "unconfigured" | "failed"
}

export const otpService = {
  maskEmail(email: string): string {
    if (!email || !email.includes("@")) return "u***@example.com"
    const [name, domain] = email.split("@")
    const maskedName = name.length > 2 ? `${name[0]}***${name[name.length - 1]}` : `${name[0]}***`
    return `${maskedName}@${domain}`
  },

  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "")
    if (digits.length <= 4) return "******" + digits
    const lastFour = digits.slice(-4)
    return `******${lastFour}`
  },

  async issueOtp(targetIdentifier: string, expirySeconds = 300): Promise<PasswordResetResponse> {
    const res = await authService.requestPasswordReset(targetIdentifier)
    if (res.success) {
      const session: OtpSession = {
        target: targetIdentifier,
        expiresAt: Date.now() + expirySeconds * 1000,
        devCode: res.devCode,
        deliveryStatus: res.deliveryStatus,
      }
      sessionStorage.setItem("signvaani.active_otp", JSON.stringify(session))
    }
    return res
  },

  async verifyOtp(
    targetIdentifier: string,
    code: string
  ): Promise<VerifyOtpResponse> {
    const res = await authService.verifyPasswordResetOtp(targetIdentifier, code)
    if (res.success && res.resetToken) {
      sessionStorage.setItem("signvaani.reset_token", res.resetToken)
      sessionStorage.removeItem("signvaani.active_otp")
    }
    return res
  },

  getStoredSession(): OtpSession | null {
    try {
      const raw = sessionStorage.getItem("signvaani.active_otp")
      return raw ? JSON.parse(raw) : null
    } catch {
      return null
    }
  },

  getStoredResetToken(): string | null {
    return sessionStorage.getItem("signvaani.reset_token")
  },

  clearSession() {
    sessionStorage.removeItem("signvaani.active_otp")
    sessionStorage.removeItem("signvaani.reset_token")
  },
}
