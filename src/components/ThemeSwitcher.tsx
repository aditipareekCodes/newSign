import React from "react"
import { useTheme } from "../context/ThemeContext"
import { SunIcon, MoonIcon, MonitorIcon } from "./Icons"
import { ThemeMode } from "../types"

interface ThemeSwitcherProps {
  variant?: "compact" | "cards"
}

export const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ variant = "compact" }) => {
  const { theme, setTheme } = useTheme()

  const options: { id: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { id: "light", label: "Light", icon: <SunIcon size={16} /> },
    { id: "dark", label: "Dark", icon: <MoonIcon size={16} /> },
    { id: "system", label: "System", icon: <MonitorIcon size={16} /> },
  ]

  if (variant === "cards") {
    return (
      <div className="grid grid-cols-3 gap-3">
        {options.map((opt) => {
          const active = theme === opt.id
          return (
            <button
              key={opt.id}
              onClick={() => setTheme(opt.id)}
              className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer ${
                active
                  ? "border-[var(--color-primary)] bg-[var(--surface-soft-blue)] text-[var(--color-primary)] shadow-sm font-semibold ring-2 ring-[var(--color-primary-glow)]"
                  : "border-[var(--border-color)] bg-[var(--surface-primary)] text-[var(--text-secondary)] hover:border-[var(--color-primary)]"
              }`}
            >
              <div className="p-2 rounded-lg bg-[var(--surface-elevated)] mb-1.5">{opt.icon}</div>
              <span className="text-xs">{opt.label}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
      {options.map((opt) => {
        const active = theme === opt.id
        return (
          <button
            key={opt.id}
            onClick={() => setTheme(opt.id)}
            title={`${opt.label} theme`}
            aria-label={`${opt.label} theme`}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              active
                ? "bg-[var(--surface-primary)] text-[var(--color-primary)] shadow-sm font-semibold"
                : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            }`}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
