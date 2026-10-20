import React, { useState } from "react"
import { Language } from "../types"
import { speechService } from "../services/speechService"
import { SpeakerIcon, StopIcon } from "./Icons"
import { useAuth } from "../context/AuthContext"

interface SpeechButtonProps {
  text: string
  language: Language
  onSpoken?: () => void
  onWarning?: (msg: string) => void
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  className?: string
}

export const SpeechButton: React.FC<SpeechButtonProps> = ({
  text,
  language,
  onSpoken,
  onWarning,
  size = "md",
  showLabel = false,
  className = "",
}) => {
  const { user } = useAuth()
  const [isSpeaking, setIsSpeaking] = useState(false)

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation()

    if (isSpeaking) {
      speechService.stop()
      setIsSpeaking(false)
      return
    }

    const preferredVoice = user?.preferredVoices?.[language] || ""
    const voiceGender = user?.voiceGender || "female"
    const rate = user?.speechRate || 1.0

    const hasVoice = speechService.hasVoiceFor(language, voiceGender)
    if (!hasVoice) {
      const unavailableMsg = speechService.getUnavailableMessage(voiceGender, language)
      const helpMsg = speechService.getHelpMessage(voiceGender, language)
      onWarning?.(`${unavailableMsg} ${helpMsg}`)
      return
    }

    const success = speechService.speak(
      text,
      language,
      rate,
      preferredVoice,
      voiceGender,
      user?.voiceSelections,
      {
        onStart: () => {
          setIsSpeaking(true)
          onSpoken?.()
        },
        onEnd: () => {
          setIsSpeaking(false)
        },
        onError: (err) => {
          setIsSpeaking(false)
          console.error("Speech error", err)
          onWarning?.(err)
        },
        onVoiceWarning: (warn) => {
          onWarning?.(warn)
        },
      }
    )

    if (!success) {
      setIsSpeaking(false)
    }
  }

  const dimensions = {
    sm: "w-8 h-8",
    md: "w-10 h-10",
    lg: "w-12 h-12",
  }

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  }

  const voiceGender = user?.voiceGender || "female"
  const hasVoice = speechService.hasVoiceFor(language, voiceGender)

  return (
    <button
      type="button"
      onClick={handleSpeak}
      title={
        isSpeaking
          ? "Stop speaking"
          : !hasVoice
          ? speechService.getUnavailableMessage(voiceGender, language)
          : "Speak translation"
      }
      aria-label={
        isSpeaking
          ? "Stop speaking"
          : !hasVoice
          ? speechService.getUnavailableMessage(voiceGender, language)
          : "Speak translation"
      }
      className={`btn-tactile ${
        showLabel ? "px-4 py-2" : dimensions[size]
      } rounded-xl flex items-center justify-center transition-all cursor-pointer ${
        !hasVoice && !isSpeaking ? "opacity-60 cursor-not-allowed" : ""
      } ${
        isSpeaking
          ? "bg-[var(--color-primary)] text-white ring-4 ring-[var(--color-primary-glow)]"
          : "bg-[var(--surface-soft-blue)] text-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
      } ${className}`}
    >
      {isSpeaking ? (
        <div className="flex items-center gap-1.5">
          {/* Animated sound wave bars */}
          <div className="flex items-end gap-0.5 h-4">
            <span className="w-1 bg-current rounded-full wave-bar h-3" />
            <span className="w-1 bg-current rounded-full wave-bar h-4" />
            <span className="w-1 bg-current rounded-full wave-bar h-2" />
          </div>
          {showLabel && <span className="text-xs font-bold">Speaking...</span>}
        </div>
      ) : (
        <>
          <SpeakerIcon size={iconSizes[size]} />
          {showLabel && <span className="text-xs font-bold ml-1.5">Speak</span>}
        </>
      )}
    </button>
  )
}
