import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { apiClient } from "./apiClient"
import { authService } from "./authService"

const values = new Map<string, string>()

if (typeof globalThis.localStorage === "undefined") {
  globalThis.localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, String(value)) },
    removeItem: (key: string) => { values.delete(key) },
    clear: () => values.clear(),
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    get length() { return values.size },
  } as Storage
}

const user = {
  id: "usr_test",
  name: "Test User",
  email: "test@example.com",
  phone: "",
  gender: "",
  preferredLanguage: "English",
  speechBehaviour: "confirm",
  speechRate: 1,
  showConfidence: true,
  voiceGender: "female",
  preferredVoices: { English: "", Hindi: "", Marathi: "" },
  voiceSelections: {
    English: { female: "", male: "" },
    Hindi: { female: "", male: "" },
    Marathi: { female: "", male: "" },
  },
  theme: "system",
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

describe("authService backend integration", () => {
  beforeEach(() => {
    values.clear()
    localStorage.clear()
    apiClient.clearAuthToken()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("posts the backend login schema and persists its token and session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      user,
      token: "backend-token",
      token_type: "bearer",
    }))
    vi.stubGlobal("fetch", fetchMock)

    const result = await authService.login(" TEST@Example.com ", "correct-password")

    expect(result.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("http://127.0.0.1:8000/api/auth/login")
    expect(options.method).toBe("POST")
    expect(JSON.parse(options.body)).toEqual({
      email: "test@example.com",
      password: "correct-password",
    })
    expect(apiClient.getAuthToken()).toBe("backend-token")
    expect(authService.getCurrentSession()?.email).toBe("test@example.com")
  })

  it("does not misreport a successful backend login when session storage is blocked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      user,
      token: "backend-token",
      token_type: "bearer",
    })))
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation((key, value) => {
      if (key === "signvaani.auth_session") throw new DOMException("Storage blocked", "SecurityError")
      values.set(key, value)
    })

    const result = await authService.login(user.email, "correct-password")

    expect(result.success).toBe(true)
    expect(apiClient.getAuthToken()).toBe("backend-token")
    expect(setItem).toHaveBeenCalled()
    setItem.mockRestore()
  })

  it("preserves HTTP credential errors instead of reporting backend offline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      detail: "Invalid email or password. Please try again.",
    }, 401)))

    const result = await authService.login("test@example.com", "wrong-password")

    expect(result.success).toBe(false)
    expect(result.error).toContain("Invalid email or password")
    expect(result.error).not.toContain("Could not reach the backend")
  })

  it("leaves duplicate-email registration validation to the backend", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      detail: "An account with this email address already exists.",
    }, 400)))

    const result = await authService.registerUser(
      "Test User",
      "test@example.com",
      "1234567890",
      "correct-password",
      "registration-token",
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe("An account with this email address already exists.")
    expect(authService.getCurrentSession()).toBeNull()
  })

  it("keeps OTP requests scoped to the password-reset backend endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        delivery_status: "unconfigured",
        message: "Development code generated.",
        dev_code: "123456",
      }))
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        reset_token: "reset-token",
        message: "Verification successful.",
      }))
    vi.stubGlobal("fetch", fetchMock)

    const requested = await authService.requestPasswordReset("test@example.com")
    const verified = await authService.verifyPasswordResetOtp("test@example.com", "123456")

    expect(requested.success).toBe(true)
    expect(verified.success).toBe(true)
    expect(verified.resetToken).toBe("reset-token")
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:8000/api/auth/forgot-password",
      "http://127.0.0.1:8000/api/auth/verify-otp",
    ])
  })

  it("uses registration-specific OTP contracts and includes the verified token at account creation", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        success: true,
        message: "If this email can be registered, a verification code will be sent shortly.",
      }, 202))
      .mockResolvedValueOnce(jsonResponse({
        registration_token: "verified-registration-token",
        expires_in: 600,
        message: "Email verified.",
      }))
      .mockResolvedValueOnce(jsonResponse({
        user,
        token: "auth-token",
        token_type: "bearer",
      }, 201))
    vi.stubGlobal("fetch", fetchMock)

    const requested = await authService.requestRegistrationOtp(" TEST@Example.com ")
    const verified = await authService.verifyRegistrationOtp(" TEST@Example.com ", "123456")
    const registration = await authService.registerUser(
      "Test User",
      "test@example.com",
      "1234567890",
      "correct-password",
      verified.registrationToken || "",
    )

    expect(requested.success).toBe(true)
    expect(verified).toEqual({
      success: true,
      registrationToken: "verified-registration-token",
      expiresIn: 600,
    })
    expect(registration.success).toBe(true)
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://127.0.0.1:8000/api/auth/register/request-otp",
      "http://127.0.0.1:8000/api/auth/register/verify-otp",
      "http://127.0.0.1:8000/api/auth/register",
    ])
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: "test@example.com",
    })
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      email: "test@example.com",
      code: "123456",
    })
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
      email: "test@example.com",
      registration_token: "verified-registration-token",
    })
  })

  it("resolves a relative API base against the browser origin for Vite proxying", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "/api")
    vi.stubGlobal("window", {
      location: { origin: "http://192.168.1.20:5173" },
    })
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      success: true,
      message: "If this email can be registered, a verification code will be sent shortly.",
    }, 202))
    vi.stubGlobal("fetch", fetchMock)

    const result = await authService.requestRegistrationOtp("test@example.com")

    expect(result.success).toBe(true)
    expect(fetchMock.mock.calls[0][0]).toBe(
      "http://192.168.1.20:5173/api/auth/register/request-otp",
    )
  })

  it("surfaces transport errors and does not invent an offline registration session", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))

    const login = await authService.login("new@example.com", "secret")
    expect(login.success).toBe(false)
    expect(login.error).toContain("http://127.0.0.1:8000/api")
    expect(login.error).toContain("Failed to fetch")

    const registration = await authService.registerUser(
      "New User",
      "new@example.com",
      "",
      "secret",
      "registration-token",
    )
    expect(registration.success).toBe(false)
    expect(authService.getCurrentSession()).toBeNull()
    expect(localStorage.getItem("signvaani.auth_session")).toBeNull()
  })

  it("clears token and persisted session on logout", async () => {
    apiClient.setAuthToken("backend-token")
    localStorage.setItem("signvaani.auth_session", JSON.stringify({ email: user.email }))

    authService.logout()

    expect(apiClient.getAuthToken()).toBeNull()
    expect(localStorage.getItem("signvaani.auth_session")).toBeNull()
  })
})
