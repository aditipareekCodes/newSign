import React from "react"
import { Language } from "../types"

interface LanguageSelectorProps {
  selected: Language
  onChange: (lang: Language) => void
  size?: "sm" | "md"
  compact?: boolean
}

const languages: { id: Language; code: string; label: string }[] = [
  { id: "English", code: "EN", label: "English" },
  { id: "Hindi", code: "HI", label: "हिन्दी" },
  { id: "Marathi", code: "MR", label: "मराठी" },
]

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  selected,
  onChange,
  size = "md",
  compact = false,
}) => {
  return (
    <div className="inline-flex p-1 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border-color)]">
      {languages.map((lang) => {
        const active = selected === lang.id
        return (
          <button
            key={lang.id}
            type="button"
            onClick={() => onChange(lang.id)}
            className={`cursor-pointer rounded-lg font-bold transition-all ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-xs md:text-sm"
            } ${
              active
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
            }`}
          >
            {compact ? lang.code : `${lang.code} · ${lang.label}`}
          </button>
        )
      })}
    </div>
  )
}
