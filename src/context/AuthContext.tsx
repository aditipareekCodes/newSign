import React, { createContext, useContext, useEffect, useState } from "react"
import { StoredUser } from "../types"
import { authService } from "../services/authService"
import { storageService } from "../services/storageService"

interface AuthContextType {
  user: StoredUser | null
  isAuthenticated: boolean
  login: (email: string, password: string, rememberMe?: boolean) => Promise<{ success: boolean; error?: string }>
  register: (name: string, email: string, phone: string, password: string, registrationToken: string) => Promise<{ success: boolean; user?: StoredUser; error?: string }>
  logout: () => void
  updateProfile: (updates: { name?: string; phone?: string; gender?: "Male" | "Female" | "" }) => Promise<void>
  updateSettings: (updates: Partial<StoredUser>) => void
  rememberedEmail: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StoredUser | null>(() => {
    return authService.getCurrentSession()
  })

  const [rememberedEmail, setRememberedEmailState] = useState<string>(() => {
    return storageService.getRememberedEmail()
  })

  useEffect(() => {
    const savedEmail = storageService.getRememberedEmail()
    if (savedEmail) {
      setRememberedEmailState(savedEmail)
    }
  }, [])

  const login = async (
    email: string,
    password: string,
    rememberMe = false
  ): Promise<{ success: boolean; error?: string }> => {
    const res = await authService.login(email, password)
    if (!res.success || !res.user) {
      return { success: false, error: res.error || "Invalid email or password. Please try again." }
    }

    setUser(res.user)

    if (rememberMe) {
      storageService.setRememberedEmail(res.user.email)
      setRememberedEmailState(res.user.email)
    } else {
      storageService.setRememberedEmail("")
      setRememberedEmailState("")
    }

    return { success: true }
  }

  const register = async (
    name: string,
    email: string,
    phone: string,
    password: string,
    registrationToken: string,
  ): Promise<{ success: boolean; user?: StoredUser; error?: string }> => {
    const res = await authService.registerUser(name, email, phone, password, registrationToken)
    if (!res.success || !res.user) {
      return { success: false, error: res.error || "Registration failed." }
    }

    setUser(res.user)
    return { success: true, user: res.user }
  }

  const logout = () => {
    authService.logout()
    setUser(null)
  }

  const updateProfile = async (updates: { name?: string; phone?: string; gender?: "Male" | "Female" | "" }) => {
    if (!user) return
    await authService.updateProfileAsync(user.email, updates)
    const updated = storageService.getUser(user.email)
    setUser({ ...updated })
  }

  const updateSettings = (updates: Partial<StoredUser>) => {
    if (!user) return
    const updated: StoredUser = { ...user, ...updates }
    storageService.saveUser(updated)
    storageService.syncUserPreferencesToBackend(updated).catch(() => {})
    setUser(updated)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
        updateProfile,
        updateSettings,
        rememberedEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
