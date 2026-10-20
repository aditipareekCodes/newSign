import React, { useState } from "react"
import { useApp } from "../context/AppContext"
import { SavedPhrase, Language, PhraseTranslations } from "../types"
import { translationService } from "../services/translationService"
import { PhraseCard } from "../components/PhraseCard"
import { PageHeader } from "../components/PageHeader"
import { PrimaryButton } from "../components/PrimaryButton"
import { Modal } from "../components/Modal"
import { EmptyState } from "../components/EmptyState"
import { SearchIcon, PlusIcon, BookmarkIcon } from "../components/Icons"

export const PhraseLibraryScreen: React.FC = () => {
  const { phrases, addPhrase, deletePhrase, notify } = useApp()

  const [search, setSearch] = useState("")
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingPhrase, setEditingPhrase] = useState<SavedPhrase | null>(null)

  // Form states for Add/Edit Modal
  const [originalText, setOriginalText] = useState("")
  const [inputLang, setInputLang] = useState<Language>("English")
  const [enTranslation, setEnTranslation] = useState("")
  const [hiTranslation, setHiTranslation] = useState("")
  const [mrTranslation, setMrTranslation] = useState("")
  const [translationSource, setTranslationSource] = useState<
    "api" | "verified_local" | "user_review" | null
  >(null)
  const [isTranslating, setIsTranslating] = useState(false)

  const openAddModal = () => {
    setEditingPhrase(null)
    setOriginalText("")
    setInputLang("English")
    setEnTranslation("")
    setHiTranslation("")
    setMrTranslation("")
    setTranslationSource(null)
    setIsAddModalOpen(true)
  }

  const openEditModal = (phrase: SavedPhrase) => {
    setEditingPhrase(phrase)
    setOriginalText(phrase.originalText)
    setInputLang(phrase.originalLanguage || "English")
    setEnTranslation(phrase.translations.English)
    setHiTranslation(phrase.translations.Hindi)
    setMrTranslation(phrase.translations.Marathi)
    setTranslationSource(null)
    setIsAddModalOpen(true)
  }

  const handleAutoTranslate = async () => {
    if (!originalText.trim()) return
    setIsTranslating(true)

    const res = await translationService.translatePhrase(originalText, inputLang)
    setIsTranslating(false)

    setTranslationSource(res.source)
    setEnTranslation(res.translations.English || (inputLang === "English" ? originalText : ""))
    setHiTranslation(res.translations.Hindi || (inputLang === "Hindi" ? originalText : ""))
    setMrTranslation(res.translations.Marathi || (inputLang === "Marathi" ? originalText : ""))
  }

  const handleSavePhrase = () => {
    if (!originalText.trim()) {
      notify("Please enter phrase text.")
      return
    }

    const translations: PhraseTranslations = {
      English: enTranslation.trim() || (inputLang === "English" ? originalText.trim() : originalText.trim()),
      Hindi: hiTranslation.trim() || (inputLang === "Hindi" ? originalText.trim() : ""),
      Marathi: mrTranslation.trim() || (inputLang === "Marathi" ? originalText.trim() : ""),
    }

    if (editingPhrase) {
      deletePhrase(editingPhrase.id)
    }

    addPhrase({
      originalText: originalText.trim(),
      originalLanguage: inputLang,
      translations,
      selectedLanguage: inputLang,
    })

    setIsAddModalOpen(false)
  }

  // Search
  const filteredPhrases = phrases.filter((p) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      p.originalText.toLowerCase().includes(term) ||
      p.translations.English.toLowerCase().includes(term) ||
      p.translations.Hindi.toLowerCase().includes(term) ||
      p.translations.Marathi.toLowerCase().includes(term)
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Saved Phrases"
        subtitle="Multilingual library with independent speech audio"
        action={
          <PrimaryButton
            variant="primary"
            size="md"
            onClick={openAddModal}
            icon={<PlusIcon size={16} />}
          >
            Add Phrase
          </PrimaryButton>
        }
      />

      {/* Search Bar */}
      <div className="relative w-full">
        <SearchIcon
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search phrases in any language..."
          className="input-field pl-10"
        />
      </div>

      {/* Phrases Grid */}
      {filteredPhrases.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPhrases.map((phrase) => (
            <PhraseCard key={phrase.id} phrase={phrase} onEdit={openEditModal} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={search ? "No matching phrases" : "No saved phrases yet"}
          description={
            search
              ? `No phrases found matching "${search}". Try searching for another phrase.`
              : "Save useful sentences to quickly speak them without re-signing."
          }
          actionLabel={search ? "Clear Search" : "Add Your First Phrase"}
          onAction={search ? () => setSearch("") : openAddModal}
          icon={<BookmarkIcon size={28} />}
        />
      )}

      {/* Add / Edit Phrase Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingPhrase ? "Edit Phrase" : "Add Custom Phrase"}
        subtitle="Translate and store with complete Devanagari Unicode support"
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5">
            <PrimaryButton
              variant="outline"
              size="md"
              onClick={() => setIsAddModalOpen(false)}
            >
              Cancel
            </PrimaryButton>
            <PrimaryButton
              variant="primary"
              size="md"
              onClick={handleSavePhrase}
            >
              Save Phrase
            </PrimaryButton>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Input text & language */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Original Phrase
              </label>
              <input
                type="text"
                value={originalText}
                onChange={(e) => setOriginalText(e.target.value)}
                placeholder="e.g. I need some rest"
                className="input-field"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Input Language
              </label>
              <select
                value={inputLang}
                onChange={(e) => setInputLang(e.target.value as Language)}
                className="input-field"
              >
                <option value="English">English</option>
                <option value="Hindi">Hindi (Devanagari)</option>
                <option value="Marathi">Marathi (Devanagari)</option>
              </select>
            </div>
          </div>

          {/* Trigger auto translate */}
          <div className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
            <div>
              <span className="text-xs font-bold text-[var(--text-main)] block">
                Automatic Translation Adapter
              </span>
              <span className="text-[11px] text-[var(--text-secondary)]">
                Uses verified dictionary or translation endpoint
              </span>
            </div>
            <PrimaryButton
              variant="secondary"
              size="sm"
              onClick={handleAutoTranslate}
              disabled={!originalText.trim() || isTranslating}
            >
              {isTranslating ? "Translating..." : "Translate Phrase"}
            </PrimaryButton>
          </div>

          {/* Translation Source Indicator */}
          {translationSource && (
            <div className="p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border bg-[var(--surface-soft-blue)] border-[var(--color-primary)]/20 text-[var(--color-primary)]">
              <span>
                Translation Source:{" "}
                <b className="capitalize">
                  {translationSource === "verified_local"
                    ? "Verified Local Dictionary"
                    : translationSource === "api"
                    ? "Translation API"
                    : "User Review (Custom Input)"}
                </b>
              </span>
            </div>
          )}

          {/* Multilingual Editable Fields */}
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                <span>English Translation</span>
                <span className="text-[10px] text-[var(--text-muted)]">en-IN Speech</span>
              </label>
              <input
                type="text"
                value={enTranslation}
                onChange={(e) => setEnTranslation(e.target.value)}
                placeholder="English version"
                className="input-field"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                <span>Hindi Translation (हिन्दी)</span>
                <span className="text-[10px] text-[var(--text-muted)]">hi-IN Speech</span>
              </label>
              <input
                type="text"
                value={hiTranslation}
                onChange={(e) => setHiTranslation(e.target.value)}
                placeholder="उदा. मुझे थोड़ा आराम चाहिए।"
                className="input-field"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                <span>Marathi Translation (मराठी)</span>
                <span className="text-[10px] text-[var(--text-muted)]">mr-IN Speech</span>
              </label>
              <input
                type="text"
                value={mrTranslation}
                onChange={(e) => setMrTranslation(e.target.value)}
                placeholder="उदा. मला थोडी विश्रांती हवी आहे."
                className="input-field"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}
