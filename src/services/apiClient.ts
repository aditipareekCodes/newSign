/**
 * Centralized API Client for SignVaani Backend
 * 
 * Manages communication with FastAPI server, handles network timeouts,
 * detects backend availability, and provides a safe abstraction for offline fallback.
 */

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  isBackendAvailable: boolean
  status?: number
}

// Fallback to local default if VITE_API_BASE_URL is not set
const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api"

export const getApiBaseUrl = (): string => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env.MODE === "test") {
      return (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/+$/, "")
    }
    if (import.meta.env.DEV && (import.meta.env.VITE_API_BASE_URL === "http://127.0.0.1:8000/api" || !import.meta.env.VITE_API_BASE_URL)) {
      return "/api"
    }
    if (import.meta.env.VITE_API_BASE_URL) {
      return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, "")
    }
  }
  return DEFAULT_API_BASE_URL
}

class ApiClient {
  private timeoutMs = 8000 // 8-second timeout to handle cold-starts and external translation calls safely
  private lastKnownBackendState: boolean | null = null

  public getBaseUrl(): string {
    return getApiBaseUrl()
  }

  public isBackendOnline(): boolean | null {
    return this.lastKnownBackendState
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const res = await this.get<{ status: string; database: string }>("/health")
      const isOnline = res.isBackendAvailable && res.data?.status === "ok"
      this.lastKnownBackendState = isOnline
      return isOnline
    } catch {
      this.lastKnownBackendState = false
      return false
    }
  }

  private buildUrl(endpoint: string, params?: Record<string, string>): string {
    const base = getApiBaseUrl()
    const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`
    const requestUrl = `${base}${cleanEndpoint}`
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://127.0.0.1:5173"
    const url = /^https?:\/\//i.test(base)
      ? new URL(requestUrl)
      : new URL(requestUrl, origin)
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) {
          url.searchParams.append(key, val)
        }
      })
    }
    return url.toString()
  }

  private authTokenKey = "signvaani.auth_token"
  private inMemoryToken: string | null = null

  public getAuthToken(): string | null {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem(this.authTokenKey)
        if (stored) return stored
      }
    } catch {}
    return this.inMemoryToken
  }

  public setAuthToken(token: string) {
    this.inMemoryToken = token || null
    try {
      if (typeof localStorage !== "undefined") {
        if (token) {
          localStorage.setItem(this.authTokenKey, token)
        } else {
          localStorage.removeItem(this.authTokenKey)
        }
      }
    } catch {}
  }

  public clearAuthToken() {
    this.inMemoryToken = null
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(this.authTokenKey)
      }
    } catch {}
  }

  private async executeRequest<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    body?: any,
    params?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const url = this.buildUrl(endpoint, params)
      const headers: Record<string, string> = {
        "Accept": "application/json",
      }

      const token = this.getAuthToken()
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const options: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      }

      if (body && (method === "POST" || method === "PUT")) {
        headers["Content-Type"] = "application/json"
        options.body = JSON.stringify(body)
      }

      const response = await fetch(url, options)
      clearTimeout(timeoutId)
      this.lastKnownBackendState = true

      if (!response.ok) {
        let errorMsg = `Server error: ${response.status} ${response.statusText}`
        try {
          const errJson = await response.json()
          if (errJson.detail) {
            errorMsg = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail)
          } else if (errJson.message) {
            errorMsg = errJson.message
          }
        } catch {
          // ignore json parse error on error response
        }

        if (response.status === 502 || response.status === 504) {
          this.lastKnownBackendState = false
          return {
            data: null,
            error: "Backend server is not running or unreachable. Please ensure the backend is started.",
            isBackendAvailable: false,
            status: response.status,
          }
        }

        return {
          data: null,
          error: errorMsg,
          isBackendAvailable: true,
          status: response.status,
        }
      }

      const data = (await response.json()) as T
      return {
        data,
        error: null,
        isBackendAvailable: true,
        status: response.status,
      }
    } catch (err: any) {
      clearTimeout(timeoutId)
      this.lastKnownBackendState = false

      const isAborted = err.name === "AbortError"
      return {
        data: null,
        error: isAborted ? "Backend request timed out (offline)" : (err.message || "Network error"),
        isBackendAvailable: false,
      }
    }
  }

  public async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, "GET", undefined, params)
  }

  public async post<T>(endpoint: string, body?: any, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, "POST", body, params)
  }

  public async put<T>(endpoint: string, body?: any, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, "PUT", body, params)
  }

  public async delete<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.executeRequest<T>(endpoint, "DELETE", undefined, params)
  }
}

export const apiClient = new ApiClient()
