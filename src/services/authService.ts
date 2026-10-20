import { StoredUser } from "../types"
import { storageService } from "./storageService"
import { apiClient } from "./apiClient"

export interface AuthResponse {
  success: boolean
  user?: StoredUser
  error?: string
}

export interface AuthTokenPayload {
  user: StoredUser
  token: string
  token_type: string
}

export interface PasswordResetResponse {
  success: boolean
  deliveryStatus: "delivered" | "unconfigured" | "failed"
  message: string
  devCode?: string
}

export interface VerifyOtpResponse {
  success: boolean
  resetToken?: string
  message: string
}

export interface RegistrationOtpResponse {
  success: boolean
  message?: string
  error?: string
}

export interface RegistrationOtpVerifyResponse {
  success: boolean
  registrationToken?: string
  expiresIn?: number
  error?: string
}

// Ensure legacy plaintext accounts storage is cleaned up from browser localStorage
if (typeof localStorage !== "undefined") {
  try {
    localStorage.removeItem("signvaani.accounts")
  } catch {}
}

export const authService = {
  // ==========================================
  // Session & Authentication Operations
  // ==========================================

  async login(email: string, password: string): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase()
    const res = await apiClient.post<AuthTokenPayload>("/auth/login", {
      email: cleanEmail,
      password,
    })

    if (res.isBackendAvailable) {
      if (res.data && res.data.token) {
        // Genuine backend authentication verified! Store secure token
        apiClient.setAuthToken(res.data.token)
        const user = res.data.user
        storageService.saveUser(user)
        try {
          localStorage.setItem(
            "signvaani.auth_session",
            JSON.stringify({ email: user.email })
          )
        } catch (error) {
          console.error("Backend login succeeded, but browser session persistence failed.", error)
        }
        return { success: true, user }
      }
      return {
        success: false,
        error: res.error || "Invalid email or password. Please try again.",
      }
    }

    // Graceful offline fallback: If backend server is offline, verify if current device has cached session
    const activeSession = this.getCurrentSession()
    if (activeSession && activeSession.email.toLowerCase() === cleanEmail) {
      return { success: true, user: activeSession }
    }

    return {
      success: false,
      error: `Could not reach the backend at ${apiClient.getBaseUrl()}. ${res.error || "Please ensure the backend server is running on http://127.0.0.1:8000."}`,
    }
  },

  async registerUser(
    name: string,
    email: string,
    phone: string,
    password: string,
    registrationToken: string
  ): Promise<AuthResponse> {
    const cleanEmail = email.trim().toLowerCase()

    const res = await apiClient.post<AuthTokenPayload>("/auth/register", {
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      password,
      registration_token: registrationToken,
    })

    if (res.isBackendAvailable) {
      if (res.data && res.data.token) {
        apiClient.setAuthToken(res.data.token)
        const user = res.data.user
        storageService.saveUser(user)
        try {
          localStorage.setItem(
            "signvaani.auth_session",
            JSON.stringify({ email: user.email })
          )
        } catch (error) {
          console.error("Backend registration succeeded, but browser session persistence failed.", error)
        }
        return { success: true, user }
      }
      return {
        success: false,
        error: res.error || "Could not complete account registration.",
      }
    }

    return {
      success: false,
      error: `Registration requires the backend, but it could not be reached at ${apiClient.getBaseUrl()}. ${res.error || ""}`.trim(),
    }
  },

  async requestRegistrationOtp(email: string): Promise<RegistrationOtpResponse> {
    const res = await apiClient.post<{ success: boolean; message: string }>(
      "/auth/register/request-otp",
      { email: email.trim().toLowerCase() },
    )
    if (!res.isBackendAvailable || !res.data) {
      return { success: false, error: res.error || "Could not request a registration code." }
    }
    return { success: res.data.success, message: res.data.message }
  },

  async verifyRegistrationOtp(
    email: string,
    code: string,
  ): Promise<RegistrationOtpVerifyResponse> {
    const res = await apiClient.post<{
      registration_token: string
      expires_in: number
      message: string
    }>("/auth/register/verify-otp", {
      email: email.trim().toLowerCase(),
      code,
    })
    if (!res.isBackendAvailable || !res.data) {
      return { success: false, error: res.error || "Could not verify the registration code." }
    }
    return {
      success: true,
      registrationToken: res.data.registration_token,
      expiresIn: res.data.expires_in,
    }
  },

  async requestPasswordReset(identifier: string): Promise<PasswordResetResponse> {
    try {
      const res = await apiClient.post<{
        success: boolean
        delivery_status: "delivered" | "unconfigured"
        message: string
        dev_code?: string
      }>("/auth/forgot-password", { identifier })

      if (res.isBackendAvailable && res.data) {
        return {
          success: res.data.success,
          deliveryStatus: res.data.delivery_status,
          message: res.data.message,
          devCode: res.data.dev_code,
        }
      }

      return {
        success: false,
        deliveryStatus: "failed",
        message: res.error || "Unable to request password reset code.",
      }
    } catch (e: any) {
      return {
        success: false,
        deliveryStatus: "failed",
        message: e?.message || "Password reset request failed.",
      }
    }
  },

  async verifyPasswordResetOtp(
    identifier: string,
    code: string
  ): Promise<VerifyOtpResponse> {
    try {
      const res = await apiClient.post<{
        success: boolean
        reset_token?: string
        message: string
      }>("/auth/verify-otp", { identifier, code })

      if (res.isBackendAvailable && res.data) {
        return {
          success: res.data.success,
          resetToken: res.data.reset_token,
          message: res.data.message,
        }
      }

      return {
        success: false,
        message: res.error || "Invalid or expired verification code.",
      }
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || "Verification failed.",
      }
    }
  },

  async resetPasswordWithToken(
    resetToken: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiClient.post<{ success: boolean; message: string }>(
        "/auth/reset-password",
        {
          reset_token: resetToken,
          new_password: newPassword,
        }
      )

      if (res.isBackendAvailable && res.data) {
        return { success: res.data.success, message: res.data.message }
      }

      return {
        success: false,
        message: res.error || "Failed to update password with provided token.",
      }
    } catch (e: any) {
      return { success: false, message: e?.message || "Password update error." }
    }
  },

  getCurrentSession(): StoredUser | null {
    try {
      const raw = localStorage.getItem("signvaani.auth_session")
      if (!raw) return null
      const session = JSON.parse(raw)
      if (!session || !session.email) return null
      return storageService.getUser(session.email)
    } catch {
      return null
    }
  },

  logout() {
    apiClient.clearAuthToken()
    localStorage.removeItem("signvaani.auth_session")
  },

  // ==========================================
  // Profile & Preferences Async Operations
  // ==========================================

  async updateProfileAsync(
    email: string,
    updates: { name?: string; phone?: string; gender?: "Male" | "Female" | "" }
  ): Promise<boolean> {
    const profile = storageService.getUser(email)
    if (updates.name !== undefined) profile.name = updates.name.trim()
    if (updates.phone !== undefined) profile.phone = updates.phone.trim()
    if (updates.gender !== undefined) profile.gender = updates.gender
    storageService.saveUser(profile)

    try {
      const res = await apiClient.put<StoredUser>("/users/profile", {
        email,
        ...updates,
      })
      if (res.isBackendAvailable && res.data) {
        storageService.saveUser(res.data)
        return true
      }
    } catch {
      // Offline fallback: local update already persisted
    }
    return true
  },

  async changePasswordAsync(
    email: string,
    oldPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await apiClient.put<{ success: boolean; message: string }>(
        "/users/password",
        {
          email,
          currentPassword: oldPassword,
          newPassword,
        }
      )

      if (res.isBackendAvailable) {
        if (res.data?.success) {
          return { success: true }
        }
        return {
          success: false,
          error: res.error || "Current password is incorrect.",
        }
      }
    } catch {
      // Backend offline
    }

    return {
      success: false,
      error: "Backend is currently offline. Password cannot be changed offline.",
    }
  },
}
