import React, { createContext, useContext, useEffect, useState } from "react"
import { ThemeMode } from "../types"
import { storageService } from "../services/storageService"

interface ThemeContextType {
  theme: ThemeMode
  effectiveTheme: "light" | "dark"
  setTheme: (theme: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export const ThemeProvider: React.FC<{ children: React.ReactNode; userEmail?: string }> = ({
  children,
  userEmail = "",
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return storageService.getTheme(userEmail)
  })

  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light")

  useEffect(() => {
    const updateEffectiveTheme = () => {
      let isDark = false
      if (theme === "dark") {
        isDark = true
      } else if (theme === "light") {
        isDark = false
      } else {
        // System preference
        isDark =
          typeof window !== "undefined" &&
          window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
      }

      setEffectiveTheme(isDark ? "dark" : "light")

      if (typeof document !== "undefined") {
        if (isDark) {
          document.documentElement.classList.add("dark")
        } else {
          document.documentElement.classList.remove("dark")
        }
      }
    }

    updateEffectiveTheme()

    if (theme === "system" && typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const listener = () => updateEffectiveTheme()
      mediaQuery.addEventListener("change", listener)
      return () => mediaQuery.removeEventListener("change", listener)
    }
  }, [theme])

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme)
    storageService.saveTheme(newTheme, userEmail)
  }

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
