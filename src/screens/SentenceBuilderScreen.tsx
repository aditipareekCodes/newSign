import React, { useState, useEffect } from "react"
import { useApp } from "../context/AppContext"
import { useAuth } from "../context/AuthContext"
import { Language } from "../types"
import { translationService } from "../services/translationService"
import { speechService } from "../services/speechService"
import {
  XIcon,
  PlusIcon,
  UndoIcon,
  SpeakerIcon,
  StopIcon,
  BookmarkIcon,
  RotateCwIcon,
  EditIcon,
  CheckIcon,
  AlertIcon,
} from "../components/Icons"
import { PageHeader } from "../components/PageHeader"
import { PrimaryButton } from "../components/PrimaryButton"
import { LanguageSelector } from "../components/LanguageSelector"
import { Modal } from "../components/Modal"
import { SUPPORTED_ISL_WORDS } from "../services/recognitionService"

export const SentenceBuilderScreen: React.FC = () => {
  const {
    setScreen,
    activeWords,
    addWord,
    removeWord,
    clearWords,
    defaultLanguage,
    addPhrase,
    recordCommunication,
    notify,
  } = useApp()
  const { user } = useAuth()

  // Assemble natural sentence from chips
  const assembleSentence = (words: string[]) => {
    if (!words.length) return "I need water."
    return words.map((w, i) => (i === 0 ? w[0] + w.slice(1).toLowerCase() : w.toLowerCase())).join(" ") + "."
  }

  const [rawText, setRawText] = useState(() => assembleSentence(activeWords))
  const [selectedLang, setSelectedLang] = useState<Language>(defaultLanguage)
  const [translatedText, setTranslatedText] = useState("")
  const [translationSource, setTranslationSource] = useState<"api" | "verified_local" | "user_review">("verified_local")
  const [isTranslating, setIsTranslating] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [manualModalOpen, setManualModalOpen] = useState(false)
  const [editingSentence, setEditingSentence] = useState(false)

  // Update rawText when word chips change (if not currently manually edited)
  useEffect(() => {
    if (!editingSentence && activeWords.length > 0) {
      setRawText(assembleSentence(activeWords))
    }
  }, [activeWords, editingSentence])

  // Automatically fetch translation when sentence or language changes
  useEffect(() => {
    let isCurrent = true
    const fetchTranslation = async () => {
      setIsTranslating(true)
      const res = await translationService.translatePhrase(rawText, "English")
      if (isCurrent) {
        setIsTranslating(false)
        setTranslationSource(res.source)
        const target = res.translations[selectedLang] || rawText
        setTranslatedText(target)
      }
    }
    fetchTranslation()
    return () => {
      isCurrent = false
    }
  }, [rawText, selectedLang])

  const voiceGender = user?.voiceGender || "female"
  const hasVoiceForOutput = speechService.hasVoiceFor(selectedLang, voiceGender)

  const handleSpeak = () => {
    if (isSpeaking) {
      speechService.stop()
      setIsSpeaking(false)
      return
    }

    if (!speechService.hasVoiceFor(selectedLang, voiceGender)) {
      notify(`${speechService.getUnavailableMessage(voiceGender, selectedLang)} ${speechService.getHelpMessage(voiceGender, selectedLang)}`)
      return
    }

    const textToSpeak = translatedText || rawText
    const preferredVoice = user?.preferredVoices?.[selectedLang] || ""
    const rate = user?.speechRate || 1.0

    const ok = speechService.speak(
      textToSpeak,
      selectedLang,
      rate,
      preferredVoice,
      voiceGender,
      user?.voiceSelections,
      {
        onStart: () => {
          setIsSpeaking(true)
          // Record communication in history only when speech starts successfully!
          recordCommunication({
            text: rawText,
            translation: textToSpeak,
            language: selectedLang,
            source: "recognition",
          })
        },
        onEnd: () => {
          setIsSpeaking(false)
        },
        onError: (err) => {
          setIsSpeaking(false)
          notify(err)
        },
        onVoiceWarning: (warn) => {
          notify(warn)
        },
      }
    )

    if (!ok) {
      setIsSpeaking(false)
    }
  }

  const handleSaveAsPhrase = async () => {
    const fullTranslations = await translationService.translatePhrase(rawText, "English")
    addPhrase({
      originalText: rawText,
      originalLanguage: "English",
      translations: {
        English: fullTranslations.translations.English || rawText,
        Hindi: fullTranslations.translations.Hindi || rawText,
        Marathi: fullTranslations.translations.Marathi || rawText,
      },
      selectedLanguage: selectedLang,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Sentence Builder"
        subtitle="Review, edit, and translate your recognized message"
        onBack={() => setScreen("recognize")}
        action={
          <div className="flex items-center gap-2">
            <PrimaryButton
              variant="outline"
              size="sm"
              onClick={() => setManualModalOpen(true)}
              icon={<PlusIcon size={14} />}
            >
              Add Word
            </PrimaryButton>
          </div>
        }
      />

      {/* Interactive Word Chips Stage with Gesture Flow Trail */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm relative overflow-hidden space-y-4">
        {/* Curved motion trail SVG background */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-20 text-[var(--color-primary)]"
          preserveAspectRatio="none"
          viewBox="0 0 500 150"
        >
          <path
            d="M 10,75 Q 150,15 250,75 T 490,75"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="6,6"
          />
        </svg>

        <div className="flex items-center justify-between relative z-10">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Recognized Word Chips
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeWords.length > 0) removeWord(activeWords.length - 1)
              }}
              disabled={activeWords.length === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--color-primary)] disabled:opacity-40 cursor-pointer"
            >
              <UndoIcon size={13} />
              <span>Undo</span>
            </button>

            <button
              onClick={clearWords}
              disabled={activeWords.length === 0}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-emergency)] hover:underline disabled:opacity-40 cursor-pointer ml-2"
            >
              <XIcon size={13} />
              <span>Clear</span>
            </button>
          </div>
        </div>

        {/* Word Chips Row */}
        <div className="flex flex-wrap gap-2.5 min-h-[56px] relative z-10">
          {activeWords.length > 0 ? (
            activeWords.map((word, idx) => (
              <span
                key={`${word}-${idx}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-color)] text-sm font-extrabold text-[var(--text-main)] shadow-sm hover:scale-105 transition-all"
              >
                <span>{word}</span>
                <button
                  onClick={() => removeWord(idx)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--color-emergency)] cursor-pointer"
                  aria-label={`Remove word ${word}`}
                >
                  <XIcon size={12} />
                </button>
              </span>
            ))
          ) : (
            <p className="text-xs text-[var(--text-secondary)] italic my-auto">
              No chips in tray. Add words manually or return to Recognition.
            </p>
          )}
        </div>
      </div>

      {/* Editable Final Sentence Card */}
      <div className="p-5 sm:p-6 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
            Final English Sentence
          </span>
          <button
            onClick={() => setEditingSentence(!editingSentence)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-primary)] hover:underline cursor-pointer"
          >
            <EditIcon size={13} />
            <span>{editingSentence ? "Done Editing" : "Edit Text"}</span>
          </button>
        </div>

        {editingSentence ? (
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={2}
            className="w-full p-3 rounded-xl border border-[var(--color-primary)] bg-[var(--surface-primary)] text-base font-bold text-[var(--text-main)] outline-none resize-none"
          />
        ) : (
          <p className="text-xl sm:text-2xl font-extrabold text-[var(--text-main)] leading-snug">
            "{rawText}"
          </p>
        )}
      </div>

      {/* Translation & Voice Output Section */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[var(--surface-primary)] to-[var(--surface-soft-blue)] border border-[var(--border-color)] shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider block">
              Multilingual Translation
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              Select output language for vocalization
            </span>
          </div>

          <LanguageSelector
            selected={selectedLang}
            onChange={setSelectedLang}
            size="md"
          />
        </div>

        {/* Translation Output Box */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--color-primary)]">
                {selectedLang} Result
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  translationSource === "api"
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                    : translationSource === "verified_local"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                }`}
              >
                {translationSource === "api"
                  ? "Live API"
                  : translationSource === "verified_local"
                  ? "Verified Dictionary"
                  : "Fallback / Custom"}
              </span>
            </div>
            {isTranslating && (
              <span className="text-xs text-[var(--text-muted)] animate-pulse">
                Translating...
              </span>
            )}
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-main)] min-h-[44px]">
            {translatedText || rawText}
          </div>
        </div>

        {/* Unavailable voice warning if no compatible voice exists on device */}
        {!hasVoiceForOutput && (
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertIcon size={16} />
              <span>{speechService.getUnavailableMessage(voiceGender, selectedLang)}</span>
            </div>
            <p className="text-[11px] opacity-90 pl-5">
              {speechService.getHelpMessage(voiceGender, selectedLang)}
            </p>
          </div>
        )}

        {/* Action Controls: Speak & Save */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
          {/* Main Speak CTA with live waveform */}
          <button
            onClick={handleSpeak}
            disabled={!hasVoiceForOutput && !isSpeaking}
            title={
              !hasVoiceForOutput
                ? speechService.getUnavailableMessage(voiceGender, selectedLang)
                : ""
            }
            className={`btn-tactile flex-1 h-13 px-6 rounded-2xl font-extrabold text-base flex items-center justify-center gap-3 cursor-pointer shadow-md transition-all ${
              !hasVoiceForOutput && !isSpeaking ? "opacity-60 cursor-not-allowed" : ""
            } ${
              isSpeaking
                ? "bg-[var(--color-primary)] text-white ring-4 ring-[var(--color-primary-glow)]"
                : "btn-primary"
            }`}
          >
            {isSpeaking ? (
              <>
                <div className="flex items-end gap-1 h-5">
                  <span className="w-1.5 bg-white rounded-full wave-bar h-3" />
                  <span className="w-1.5 bg-white rounded-full wave-bar h-5" />
                  <span className="w-1.5 bg-white rounded-full wave-bar h-2" />
                  <span className="w-1.5 bg-white rounded-full wave-bar h-4" />
                </div>
                <span>Speaking Now... (Tap to Stop)</span>
              </>
            ) : (
              <>
                <SpeakerIcon size={22} color="currentColor" />
                <span>Speak Out Loud ({selectedLang})</span>
              </>
            )}
          </button>

          {/* Secondary Actions */}
          <div className="flex items-center gap-2">
            <PrimaryButton
              variant="outline"
              size="lg"
              onClick={handleSaveAsPhrase}
              icon={<BookmarkIcon size={18} />}
            >
              Save as Phrase
            </PrimaryButton>
          </div>
        </div>
      </div>

      {/* Manual Word Picker Modal */}
      <Modal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        title="Add Word to Sentence"
        subtitle="Pick from supported sign gestures"
        maxWidth="md"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
          {SUPPORTED_ISL_WORDS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => {
                addWord(w)
                setManualModalOpen(false)
                notify(`Added "${w}"`)
              }}
              className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-color)] hover:border-[var(--color-primary)] hover:bg-[var(--surface-soft-blue)] text-xs font-bold text-[var(--text-main)] transition-all cursor-pointer text-center"
            >
              {w}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
