import React, { useState } from "react"
import { Language } from "../types"
import { Modal } from "../components/Modal"
import { LanguageSelector } from "../components/LanguageSelector"
import { SpeechButton } from "../components/SpeechButton"
import { AlertIcon, PhoneIcon } from "../components/Icons"
import { useApp } from "../context/AppContext"
import { translationService } from "../services/translationService"

interface EmergencyModalProps {
  isOpen: boolean
  onClose: () => void
}

const emergencyPhrasesList = [
  "I need medical help.",
  "Please call an ambulance.",
  "Please call the police.",
  "I am in danger.",
  "Please contact my family.",
  "I cannot speak.",
]

export const EmergencyModal: React.FC<EmergencyModalProps> = ({ isOpen, onClose }) => {
  const { defaultLanguage, recordCommunication, notify } = useApp()
  const [emergencyLang, setEmergencyLang] = useState<Language>(defaultLanguage)

  const handleSpoken = (original: string, translated: string) => {
    recordCommunication({
      text: original,
      translation: translated,
      language: emergencyLang,
      source: "emergency_phrase",
    })
    notify("Emergency phrase broadcasted")
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Emergency Communication"
      subtitle="High-priority instant phrases spoken immediately"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Banner */}
        <div className="p-3.5 rounded-2xl bg-[var(--color-emergency-surface)] border border-[var(--color-emergency-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[var(--color-emergency)]">
            <AlertIcon size={22} color="currentColor" />
            <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wide">
              Urgent Broadcast
            </span>
          </div>

          {/* Emergency Language Selector */}
          <div className="shrink-0">
            <LanguageSelector
              selected={emergencyLang}
              onChange={setEmergencyLang}
              size="sm"
              compact
            />
          </div>
        </div>

        {/* Phrases List */}
        <div className="grid grid-cols-1 gap-2.5">
          {emergencyPhrasesList.map((phrase) => {
            // Get verified translation directly
            let translated = phrase
            if (emergencyLang === "Hindi") {
              if (phrase === "I need medical help.") translated = "मुझे चिकित्सकीय सहायता चाहिए।"
              else if (phrase === "Please call an ambulance.") translated = "कृपया एम्बुलेंस बुलाएं।"
              else if (phrase === "Please call the police.") translated = "कृपया पुलिस को बुलाएं।"
              else if (phrase === "I am in danger.") translated = "मैं खतरे में हूँ।"
              else if (phrase === "Please contact my family.") translated = "कृपया मेरे परिवार से संपर्क करें।"
              else if (phrase === "I cannot speak.") translated = "मैं बोल नहीं सकता।"
            } else if (emergencyLang === "Marathi") {
              if (phrase === "I need medical help.") translated = "मला वैद्यकीय मदत हवी आहे."
              else if (phrase === "Please call an ambulance.") translated = "कृपया रुग्णवाहिका बोलवा."
              else if (phrase === "Please call the police.") translated = "कृपया पोलिसांना बोलवा."
              else if (phrase === "I am in danger.") translated = "मी धोक्यात आहे."
              else if (phrase === "Please contact my family.") translated = "कृपया माझ्या कुटुंबाशी संपर्क करा."
              else if (phrase === "I cannot speak.") translated = "मला बोलता येत नाही."
            }

            return (
              <div
                key={phrase}
                className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[var(--color-emergency-surface)] border-2 border-[var(--color-emergency-border)] hover:border-[var(--color-emergency)] transition-colors shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm sm:text-base font-bold text-[var(--color-emergency)] leading-tight">
                    {translated}
                  </p>
                  {emergencyLang !== "English" && (
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5 italic">
                      {phrase}
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  <SpeechButton
                    text={translated}
                    language={emergencyLang}
                    onSpoken={() => handleSpoken(phrase, translated)}
                    onWarning={(msg) => notify(msg)}
                    size="md"
                    className="!bg-[var(--color-emergency)] !text-white hover:!filter hover:!brightness-110"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
