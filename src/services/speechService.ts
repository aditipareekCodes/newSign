import { Language, VoiceGender, VoiceSelections } from "../types"

export interface SpeechCallbacks {
  onStart?: () => void
  onEnd?: () => void
  onError?: (error: string) => void
  onVoiceWarning?: (warning: string) => void
}

const languageLocales: Record<Language, string> = {
  English: "en-IN",
  Hindi: "hi-IN",
  Marathi: "mr-IN",
}

export const FEMALE_HINTS = [
  "female",
  "neerja",
  "swara",
  "aarti",
  "zira",
  "samantha",
  "aria",
  "jenny",
  "hazel",
  "heera",
  "lekha",
  "susan",
  "aarohi",
  "kalpana",
  "ananya",
  "kavya",
  "priya",
  "shreya",
  "sunita",
  "veena",
]

export const MALE_HINTS = [
  "male",
  "prabhat",
  "madhur",
  "manohar",
  "ravi",
  "david",
  "mark",
  "guy",
  "george",
  "ryan",
  "hemant",
  "rehaan",
  "ajay",
  "sanjay",
  "kailash",
]

export const classifyVoiceGender = (voice: SpeechSynthesisVoice): VoiceGender | null => {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase()

  // Google's default Hindi voice in Chromium: "Google हिन्दी" is female
  if (
    name.includes("google") &&
    (lang.startsWith("hi") || name.includes("हिन्दी") || name.includes("hindi"))
  ) {
    return "female"
  }

  const hasFemaleHint = FEMALE_HINTS.some((hint) => {
    if (hint === "female") {
      return /\bfemale\b/i.test(name) || name.includes("female")
    }
    return name.includes(hint)
  })

  const hasMaleHint = MALE_HINTS.some((hint) => {
    if (hint === "male") {
      // Must not match "male" inside "female"
      const stripped = name.replace(/female/g, "")
      return /\bmale\b/i.test(stripped) || stripped.includes("male")
    }
    return name.includes(hint)
  })

  if (hasFemaleHint && !hasMaleHint) return "female"
  if (hasMaleHint && !hasFemaleHint) return "male"
  if (hasFemaleHint && hasMaleHint) {
    if (name.includes("female")) return "female"
    return null
  }
  return null
}

export const isVoiceMatchingLanguage = (voice: SpeechSynthesisVoice, language: Language): boolean => {
  const normLang = voice.lang.toLowerCase().replace("_", "-")
  const normName = voice.name.toLowerCase()

  if (language === "English") {
    return normLang.startsWith("en")
  }
  if (language === "Hindi") {
    return (
      normLang === "hi-in" ||
      normLang.startsWith("hi-in") ||
      normLang === "hi" ||
      normName.includes("hindi") ||
      normName.includes("हिन्दी")
    )
  }
  if (language === "Marathi") {
    return (
      normLang === "mr-in" ||
      normLang.startsWith("mr-in") ||
      normLang === "mr" ||
      normName.includes("marathi") ||
      normName.includes("मराठी")
    )
  }
  return false
}

export const getVoiceIdentifier = (voice: SpeechSynthesisVoice): string => {
  return voice.voiceURI || voice.name
}

export const isVoiceMatch = (voice: SpeechSynthesisVoice, identifier: string): boolean => {
  if (!identifier) return false
  return voice.voiceURI === identifier || voice.name === identifier
}

class SpeechService {
  private voices: SpeechSynthesisVoice[] = []
  private isLoaded = false
  private activeUtterance: SpeechSynthesisUtterance | null = null

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.loadVoices()
      window.speechSynthesis.addEventListener("voiceschanged", () => {
        this.loadVoices()
      })
    }
  }

  private loadVoices() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return
    const available = window.speechSynthesis.getVoices()
    if (available.length > 0) {
      this.voices = available
      this.isLoaded = true
    }
  }

  public getVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0 && typeof window !== "undefined" && "speechSynthesis" in window) {
      this.loadVoices()
    }
    return this.voices
  }

  public getVoicesForLanguage(lang: Language): SpeechSynthesisVoice[] {
    return this.getVoicesFor(lang)
  }

  public getVoicesFor(language: Language, gender?: VoiceGender): SpeechSynthesisVoice[] {
    const allVoices = this.getVoices()

    if (language === "English") {
      // Prioritize en-IN voices first, followed by all other English voices
      const enIn: SpeechSynthesisVoice[] = []
      const others: SpeechSynthesisVoice[] = []

      for (const v of allVoices) {
        if (!isVoiceMatchingLanguage(v, "English")) continue
        const norm = v.lang.toLowerCase().replace("_", "-")
        if (norm === "en-in" || norm.startsWith("en-in") || v.name.toLowerCase().includes("india")) {
          enIn.push(v)
        } else {
          others.push(v)
        }
      }

      const combined = [...enIn, ...others]
      if (!gender) return combined
      return combined.filter((v) => classifyVoiceGender(v) === gender)
    }

    if (language === "Marathi") {
      // 1. Check for native Marathi voices first
      const nativeMr = allVoices.filter((v) => isVoiceMatchingLanguage(v, "Marathi"))
      const matchingNative = gender ? nativeMr.filter((v) => classifyVoiceGender(v) === gender) : nativeMr

      if (matchingNative.length > 0) {
        return matchingNative
      }

      // 2. If no native Marathi voice is installed on this device,
      // fallback to compatible Devanagari (Hindi) voices of the EXACT SAME GENDER!
      // This ensures Marathi vocalization functions properly while strictly preserving gender!
      const devanagariVoices = allVoices.filter((v) => isVoiceMatchingLanguage(v, "Hindi"))
      const matchingDevanagari = gender
        ? devanagariVoices.filter((v) => classifyVoiceGender(v) === gender)
        : devanagariVoices
      return matchingDevanagari
    }

    const matchingLang = allVoices.filter((v) => isVoiceMatchingLanguage(v, language))
    if (!gender) return matchingLang
    return matchingLang.filter((v) => classifyVoiceGender(v) === gender)
  }

  public hasNativeVoiceFor(language: Language): boolean {
    const allVoices = this.getVoices()
    return allVoices.some((v) => isVoiceMatchingLanguage(v, language))
  }

  public isUsingDevanagariFallback(language: Language, voice: SpeechSynthesisVoice): boolean {
    if (language !== "Marathi") return false
    return !isVoiceMatchingLanguage(voice, "Marathi")
  }

  public isVoiceMatchingGender(voice: SpeechSynthesisVoice, gender: VoiceGender): boolean {
    return classifyVoiceGender(voice) === gender
  }

  public hasVoiceFor(language: Language, gender: VoiceGender): boolean {
    return this.getVoicesFor(language, gender).length > 0
  }

  public getUnavailableMessage(gender: VoiceGender, language: Language): string {
    return `No ${gender} ${language} voice is available on this device.`
  }

  public getHelpMessage(gender: VoiceGender, language: Language): string {
    return `Please install or enable a compatible ${gender} ${language} system voice in your device or browser settings.`
  }

  public getVoiceIdentifier(voice: SpeechSynthesisVoice): string {
    return getVoiceIdentifier(voice)
  }

  public resolveVoice(
    language: Language,
    gender: VoiceGender = "female",
    voiceSelections?: VoiceSelections,
    preferredVoiceName = ""
  ): { voice: SpeechSynthesisVoice | null; warning?: string; error?: string; help?: string } {
    const matchingVoices = this.getVoicesFor(language, gender)

    if (matchingVoices.length === 0) {
      return {
        voice: null,
        error: this.getUnavailableMessage(gender, language),
        help: this.getHelpMessage(gender, language),
        warning: `${this.getUnavailableMessage(gender, language)} ${this.getHelpMessage(gender, language)}`,
      }
    }

    // 1. Check exact stored voice selection for this language and gender
    const selectedKey = voiceSelections?.[language]?.[gender]
    if (selectedKey) {
      const match = matchingVoices.find((v) => isVoiceMatch(v, selectedKey))
      if (match && classifyVoiceGender(match) === gender) {
        return { voice: match }
      }
    }

    // 2. Check preferredVoiceName backup
    if (preferredVoiceName) {
      const match = matchingVoices.find((v) => isVoiceMatch(v, preferredVoiceName))
      if (match && classifyVoiceGender(match) === gender) {
        return { voice: match }
      }
    }

    // 3. Auto-select first matching voice of requested gender
    const firstVoice = matchingVoices[0]
    if (firstVoice && classifyVoiceGender(firstVoice) === gender) {
      return { voice: firstVoice }
    }

    // Never substitute opposite-gender voice
    return {
      voice: null,
      error: this.getUnavailableMessage(gender, language),
      help: this.getHelpMessage(gender, language),
      warning: `${this.getUnavailableMessage(gender, language)} ${this.getHelpMessage(gender, language)}`,
    }
  }

  public speak(
    text: string,
    language: Language = "English",
    rate = 1.0,
    preferredVoiceName = "",
    genderPreference: VoiceGender = "female",
    voiceSelectionsOrCallbacks?: VoiceSelections | SpeechCallbacks,
    callbacks?: SpeechCallbacks
  ): boolean {
    let voiceSelections: VoiceSelections | undefined
    let effectiveCallbacks: SpeechCallbacks | undefined

    if (
      voiceSelectionsOrCallbacks &&
      ("onStart" in voiceSelectionsOrCallbacks ||
        "onError" in voiceSelectionsOrCallbacks ||
        "onEnd" in voiceSelectionsOrCallbacks ||
        "onVoiceWarning" in voiceSelectionsOrCallbacks)
    ) {
      effectiveCallbacks = voiceSelectionsOrCallbacks as SpeechCallbacks
    } else if (voiceSelectionsOrCallbacks) {
      voiceSelections = voiceSelectionsOrCallbacks as VoiceSelections
      effectiveCallbacks = callbacks
    } else {
      effectiveCallbacks = callbacks
    }

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      effectiveCallbacks?.onError?.("Speech synthesis is not supported on this browser.")
      return false
    }

    if (!text || !text.trim()) {
      effectiveCallbacks?.onError?.("No text provided to speak.")
      return false
    }

    const { voice, error, help, warning } = this.resolveVoice(
      language,
      genderPreference,
      voiceSelections,
      preferredVoiceName
    )

    if (!voice) {
      const errorMsg = error || this.getUnavailableMessage(genderPreference, language)
      const helpMsg = help || this.getHelpMessage(genderPreference, language)
      const fullMsg = `${errorMsg} ${helpMsg}`
      effectiveCallbacks?.onError?.(fullMsg)
      effectiveCallbacks?.onVoiceWarning?.(fullMsg)
      return false
    }

    // Strict validation: NEVER speak with wrong gender
    if (classifyVoiceGender(voice) !== genderPreference) {
      const errorMsg = this.getUnavailableMessage(genderPreference, language)
      effectiveCallbacks?.onError?.(errorMsg)
      return false
    }

    if (warning && !voice) {
      effectiveCallbacks?.onVoiceWarning?.(warning)
    }

    this.stop()

    const cleanText = text.trim()
    const targetLocale = languageLocales[language] || "en-IN"

    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.voice = voice
    utterance.lang = voice.lang || targetLocale
    utterance.rate = Math.max(0.5, Math.min(rate, 2.0))
    utterance.pitch = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => {
      effectiveCallbacks?.onStart?.()
    }

    utterance.onend = () => {
      this.activeUtterance = null
      effectiveCallbacks?.onEnd?.()
    }

    utterance.onerror = (event) => {
      this.activeUtterance = null
      if (event.error !== "canceled" && event.error !== "interrupted") {
        effectiveCallbacks?.onError?.(`Speech error: ${event.error}`)
      }
    }

    this.activeUtterance = utterance
    window.speechSynthesis.speak(utterance)
    return true
  }

  public stop() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      this.activeUtterance = null
    }
  }

  public isSpeaking(): boolean {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      return window.speechSynthesis.speaking
    }
    return false
  }
}

export const speechService = new SpeechService()
