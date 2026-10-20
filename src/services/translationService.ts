import { Language, PhraseTranslations } from "../types"
import { apiClient } from "./apiClient"

// Comprehensive verified multilingual dictionary for ISL gestures, emergency phrases, and core conversation
const verifiedPhrases: Record<string, PhraseTranslations> = {
  // Common & Core
  "i need water.": {
    English: "I need water.",
    Hindi: "मुझे पानी चाहिए।",
    Marathi: "मला पाणी हवे आहे.",
  },
  "i need water": {
    English: "I need water.",
    Hindi: "मुझे पानी चाहिए।",
    Marathi: "मला पाणी हवे आहे.",
  },
  "water.": {
    English: "Water.",
    Hindi: "पानी।",
    Marathi: "पाणी.",
  },
  "water": {
    English: "Water.",
    Hindi: "पानी।",
    Marathi: "पाणी.",
  },
  "please call my family.": {
    English: "Please call my family.",
    Hindi: "कृपया मेरे परिवार को बुलाओ।",
    Marathi: "कृपया माझ्या कुटुंबाला बोलवा.",
  },
  "please call my family": {
    English: "Please call my family.",
    Hindi: "कृपया मेरे परिवार को बुलाओ।",
    Marathi: "कृपया माझ्या कुटुंबाला बोलवा.",
  },
  "i want to go home.": {
    English: "I want to go home.",
    Hindi: "मैं घर जाना चाहता हूँ।",
    Marathi: "मला घरी जायचे आहे.",
  },
  "i want to go home": {
    English: "I want to go home.",
    Hindi: "मैं घर जाना चाहता हूँ।",
    Marathi: "मला घरी जायचे आहे.",
  },
  "thank you.": {
    English: "Thank you.",
    Hindi: "धन्यवाद।",
    Marathi: "धन्यवाद.",
  },
  "thank you": {
    English: "Thank you.",
    Hindi: "धन्यवाद।",
    Marathi: "धन्यवाद.",
  },
  "please help me.": {
    English: "Please help me.",
    Hindi: "कृपया मेरी मदद करें।",
    Marathi: "कृपया मला मदत करा.",
  },
  "help me.": {
    English: "Help me.",
    Hindi: "मेरी मदद करो।",
    Marathi: "मला मदत करा.",
  },
  "help.": {
    English: "Help.",
    Hindi: "मदद।",
    Marathi: "मदत.",
  },
  "i am hungry.": {
    English: "I am hungry.",
    Hindi: "मुझे भूख लगी है।",
    Marathi: "मला भूक लागली आहे.",
  },
  "i am fine.": {
    English: "I am fine.",
    Hindi: "मैं ठीक हूँ।",
    Marathi: "मी ठीक आहे.",
  },
  "good morning.": {
    English: "Good morning.",
    Hindi: "शुभ प्रभात।",
    Marathi: "शुभ सकाळ.",
  },
  "good evening.": {
    English: "Good evening.",
    Hindi: "शुभ संध्या।",
    Marathi: "शुभ संध्याकाळ.",
  },

  // Emergency Phrases
  "i need medical help.": {
    English: "I need medical help.",
    Hindi: "मुझे चिकित्सकीय सहायता चाहिए।",
    Marathi: "मला वैद्यकीय मदत हवी आहे.",
  },
  "please call an ambulance.": {
    English: "Please call an ambulance.",
    Hindi: "कृपया एम्बुलेंस बुलाएं।",
    Marathi: "कृपया रुग्णवाहिका बोलवा.",
  },
  "please call the police.": {
    English: "Please call the police.",
    Hindi: "कृपया पुलिस को बुलाएं।",
    Marathi: "कृपया पोलिसांना बोलवा.",
  },
  "i am in danger.": {
    English: "I am in danger.",
    Hindi: "मैं खतरे में हूँ।",
    Marathi: "मी धोक्यात आहे.",
  },
  "please contact my family.": {
    English: "Please contact my family.",
    Hindi: "कृपया मेरे परिवार से संपर्क करें।",
    Marathi: "कृपया माझ्या कुटुंबाशी संपर्क करा.",
  },
  "i cannot speak.": {
    English: "I cannot speak.",
    Hindi: "मैं बोल नहीं सकता।",
    Marathi: "मला बोलता येत नाही.",
  },

  // Romanized inputs
  "mujhe paani chahiye": {
    English: "I need water.",
    Hindi: "मुझे पानी चाहिए।",
    Marathi: "मला पाणी हवे आहे.",
  },
  "mala paani have aahe": {
    English: "I need water.",
    Hindi: "मुझे पानी चाहिए।",
    Marathi: "मला पाणी हवे आहे.",
  },
  "dhanyavaad": {
    English: "Thank you.",
    Hindi: "धन्यवाद।",
    Marathi: "धन्यवाद.",
  },
  "madad chahiye": {
    English: "I need help.",
    Hindi: "मुझे मदद चाहिए।",
    Marathi: "मला मदत हवी आहे.",
  },
}

const gestureDictionary: Record<string, { English: string; Hindi: string; Marathi: string }> = {
  i: { English: "I", Hindi: "मैं", Marathi: "मी" },
  need: { English: "need", Hindi: "चाहिए", Marathi: "हवे" },
  water: { English: "water", Hindi: "पानी", Marathi: "पाणी" },
  help: { English: "help", Hindi: "मदद", Marathi: "मदत" },
  family: { English: "family", Hindi: "परिवार", Marathi: "कुटुंब" },
  thank: { English: "thank", Hindi: "धन्यवाद", Marathi: "धन्यवाद" },
  you: { English: "you", Hindi: "आप", Marathi: "तुम्ही" },
  home: { English: "home", Hindi: "घर", Marathi: "घर" },
  medical: { English: "medical", Hindi: "चिकित्सा", Marathi: "वैद्यकीय" },
  please: { English: "please", Hindi: "कृपया", Marathi: "कृपया" },
  food: { English: "food", Hindi: "खाना", Marathi: "अन्न" },
  hello: { English: "hello", Hindi: "नमस्ते", Marathi: "नमस्कार" },
  pain: { English: "pain", Hindi: "दर्द", Marathi: "वेदना" },
}

export const translationService = {
  isVerified(text: string): boolean {
    const key = text.trim().toLowerCase()
    return Boolean(verifiedPhrases[key])
  },

  async translatePhrase(
    text: string,
    sourceLanguage: Language = "English"
  ): Promise<{ translations: PhraseTranslations; source: "api" | "verified_local" | "user_review" }> {
    const cleanText = text.trim()
    const lowerKey = cleanText.toLowerCase()

    if (!cleanText) {
      return {
        translations: { English: "", Hindi: "", Marathi: "" },
        source: "verified_local",
      }
    }

    // 1. Query centralized backend /api/translate endpoint (supports dictionary + live API)
    try {
      const res = await apiClient.post<{
        translations: PhraseTranslations
        source: string
        message?: string
      }>("/translate", {
        text: cleanText,
        source_language: sourceLanguage,
      })

      if (res.isBackendAvailable && res.data?.translations) {
        const srcType = res.data.source === "api" ? "api" : "verified_local"
        return {
          translations: res.data.translations,
          source: srcType,
        }
      }
    } catch (err) {
      console.warn("Backend translation endpoint failed, falling back to local dictionary", err)
    }

    // 2. Offline / local fallback: Check verified dictionary
    if (verifiedPhrases[lowerKey]) {
      return {
        translations: { ...verifiedPhrases[lowerKey] },
        source: "verified_local",
      }
    }

    // 3. Fallback for gesture word combinations
    const words = lowerKey.replace(/[.,?!]/g, "").split(/\s+/)
    if (words.length > 0 && words.every((w) => gestureDictionary[w])) {
      if (lowerKey.includes("i") && lowerKey.includes("need") && lowerKey.includes("water")) {
        return {
          translations: verifiedPhrases["i need water."],
          source: "verified_local",
        }
      }
    }

    // 4. If unknown custom phrase and offline, do NOT pretend English is Hindi/Marathi!
    // Preserve the source text for the source language, and leave others for manual review
    const partial: PhraseTranslations = {
      English: sourceLanguage === "English" ? cleanText : "",
      Hindi: sourceLanguage === "Hindi" ? cleanText : "",
      Marathi: sourceLanguage === "Marathi" ? cleanText : "",
    }

    return {
      translations: partial,
      source: "user_review",
    }
  },

  getSingleWordTranslation(word: string, lang: Language): string {
    const key = word.trim().toLowerCase()
    if (key === "thankyou") {
      return gestureDictionary["thank"]?.[lang] || word
    }
    const entry = gestureDictionary[key]
    if (entry) return entry[lang]
    return word
  },
}
