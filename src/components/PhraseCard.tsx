import React, { useState } from "react"
import { SavedPhrase, Language } from "../types"
import { SpeechButton } from "./SpeechButton"
import { TrashIcon, EditIcon } from "./Icons"
import { useApp } from "../context/AppContext"

interface PhraseCardProps {
  phrase: SavedPhrase
  onEdit?: (phrase: SavedPhrase) => void
}

export const PhraseCard: React.FC<PhraseCardProps> = ({ phrase, onEdit }) => {
  const { deletePhrase, recordCommunication, notify, defaultLanguage } = useApp()

  // Local card state for independent language switching!
  const [selectedLang, setSelectedLang] = useState<Language>(
    phrase.selectedLanguage || defaultLanguage
  )

  const activeTranslation =
    phrase.translations[selectedLang] || phrase.originalText || "Phrase"

  const languages: { id: Language; code: string }[] = [
    { id: "English", code: "EN" },
    { id: "Hindi", code: "HI" },
    { id: "Marathi", code: "MR" },
  ]

  const handleSpoken = () => {
    recordCommunication({
      text: phrase.originalText,
      translation: activeTranslation,
      language: selectedLang,
      source: "saved_phrase",
    })
  }

  return (
    <div className="p-4 md:p-5 rounded-2xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm hover:shadow-md transition-all space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-base md:text-lg font-bold text-[var(--text-main)] leading-snug break-words">
            {activeTranslation}
          </p>
          {selectedLang !== "English" && phrase.translations.English && (
            <p className="text-xs text-[var(--text-secondary)] mt-1 font-medium italic">
              {phrase.translations.English}
            </p>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <SpeechButton
            text={activeTranslation}
            language={selectedLang}
            onSpoken={handleSpoken}
            onWarning={(msg) => notify(msg)}
            size="sm"
          />

          {onEdit && (
            <button
              onClick={() => onEdit(phrase)}
              title="Edit phrase"
              aria-label="Edit phrase"
              className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--surface-soft-blue)] transition-colors cursor-pointer"
            >
              <EditIcon size={15} />
            </button>
          )}

          <button
            onClick={() => deletePhrase(phrase.id)}
            title="Delete phrase"
            aria-label="Delete phrase"
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--color-emergency)] hover:bg-[var(--color-emergency-surface)] transition-colors cursor-pointer"
          >
            <TrashIcon size={15} />
          </button>
        </div>
      </div>

      {/* Language segmented control per card */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)]">
        <span className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Language
        </span>
        <div className="inline-flex p-0.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border-subtle)]">
          {languages.map((lang) => {
            const isActive = selectedLang === lang.id
            return (
              <button
                key={lang.id}
                type="button"
                onClick={() => setSelectedLang(lang.id)}
                className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-main)]"
                }`}
              >
                {lang.code}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
