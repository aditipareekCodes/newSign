export type Language = "English" | "Hindi" | "Marathi"

export interface PhraseTranslations {
  English: string
  Hindi: string
  Marathi: string
}

export interface SavedPhrase {
  id: string
  originalText: string
  originalLanguage: Language
  translations: PhraseTranslations
  selectedLanguage?: Language
  createdAt: string
}

export type CommunicationSource = "recognition" | "saved_phrase" | "emergency_phrase"

export interface HistoryItem {
  id: string
  text: string
  translation: string
  language: Language
  confidence: number
  createdAt: string
  source: CommunicationSource
}

export type VoiceGender = "female" | "male"

export type VoiceSelections = {
  English: {
    female: string
    male: string
  }
  Hindi: {
    female: string
    male: string
  }
  Marathi: {
    female: string
    male: string
  }
}

export interface StoredUser {
  id: string
  name: string
  email: string
  phone: string
  gender: "Male" | "Female" | ""
  preferredLanguage: Language
  speechBehaviour: "auto" | "confirm"
  speechRate: number
  showConfidence: boolean
  voiceGender: VoiceGender
  preferredVoices?: Record<Language, string>
  voiceSelections: VoiceSelections
}

export type ThemeMode = "light" | "dark" | "system"

export type Screen = "login" | "register" | "otp" | "forgot-password" | "home" | "recognize" | "sentence" | "phrases" | "history" | "profile" | "data-collection"

export interface RecognitionResult {
  word: string
  confidence: number
}

export type RecognitionState = "off" | "loading" | "ready" | "no_hand" | "detecting" | "low_confidence" | "stable" | "accepted" | "paused" | "denied"
