import {
  Language,
  SavedPhrase,
  HistoryItem,
  StoredUser,
  ThemeMode,
} from "../types"
import { apiClient } from "./apiClient"

const read = <T>(key: string, fallback: T): T => {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : fallback
  } catch {
    return fallback
  }
}

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (e) {
    console.error("Failed to write to localStorage", e)
  }
}

const userScope = (key: string, userIdOrEmail = "") => {
  const clean = userIdOrEmail.trim().toLowerCase()
  return clean ? `${key}.${clean}` : key
}

export const defaultBuiltInPhrases: SavedPhrase[] = [
  {
    id: "p1",
    originalText: "I need water.",
    originalLanguage: "English",
    translations: {
      English: "I need water.",
      Hindi: "मुझे पानी चाहिए।",
      Marathi: "मला पाणी हवे आहे.",
    },
    selectedLanguage: "English",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p2",
    originalText: "Please call my family.",
    originalLanguage: "English",
    translations: {
      English: "Please call my family.",
      Hindi: "कृपया मेरे परिवार को बुलाओ।",
      Marathi: "कृपया माझ्या कुटुंबाला बोलवा.",
    },
    selectedLanguage: "English",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p3",
    originalText: "I want to go home.",
    originalLanguage: "English",
    translations: {
      English: "I want to go home.",
      Hindi: "मैं घर जाना चाहता हूँ।",
      Marathi: "मला घरी जायचे आहे.",
    },
    selectedLanguage: "English",
    createdAt: new Date().toISOString(),
  },
  {
    id: "p4",
    originalText: "Thank you.",
    originalLanguage: "English",
    translations: {
      English: "Thank you.",
      Hindi: "धन्यवाद।",
      Marathi: "धन्यवाद.",
    },
    selectedLanguage: "English",
    createdAt: new Date().toISOString(),
  },
]

export const storageService = {
  // ==========================================
  // Synchronous LocalStorage Operations (Cache-first / Offline Fallback)
  // ==========================================

  getPhrases(owner = ""): SavedPhrase[] {
    const key = userScope("signvaani.phrases", owner)
    const stored = read<SavedPhrase[] | null>(key, null)
    if (!stored || !Array.isArray(stored) || stored.length === 0) {
      write(key, defaultBuiltInPhrases)
      return defaultBuiltInPhrases
    }
    // Normalize phrases to ensure they have all translations
    return stored.map((p) => ({
      ...p,
      translations: {
        English: p.translations?.English || p.originalText || "Phrase",
        Hindi: p.translations?.Hindi || p.translations?.English || p.originalText || "Phrase",
        Marathi: p.translations?.Marathi || p.translations?.English || p.originalText || "Phrase",
      },
    }))
  },

  savePhrases(phrases: SavedPhrase[], owner = "") {
    const key = userScope("signvaani.phrases", owner)
    write(key, phrases)
  },

  getHistory(owner = ""): HistoryItem[] {
    const key = userScope("signvaani.history", owner)
    return read<HistoryItem[]>(key, [])
  },

  saveHistory(history: HistoryItem[], owner = "") {
    const key = userScope("signvaani.history", owner)
    write(key, history)
  },

  getUser(email = ""): StoredUser {
    const defaults: StoredUser = {
      id: "user_default",
      name: "Demo User",
      email: email || "demo@signvaani.com",
      phone: "+91 98765 43210",
      gender: "",
      preferredLanguage: "English",
      speechBehaviour: "confirm",
      speechRate: 1.0,
      showConfidence: true,
      voiceGender: "female",
      preferredVoices: {
        English: "",
        Hindi: "",
        Marathi: "",
      },
      voiceSelections: {
        English: { female: "", male: "" },
        Hindi: { female: "", male: "" },
        Marathi: { female: "", male: "" },
      },
    }
    const key = userScope("signvaani.user_profile", email)
    const saved = read<Partial<StoredUser>>(key, {})
    const user: StoredUser = {
      ...defaults,
      ...saved,
      voiceGender: saved.voiceGender === "male" ? "male" : "female",
      preferredVoices: {
        English: saved.preferredVoices?.English || defaults.preferredVoices?.English || "",
        Hindi: saved.preferredVoices?.Hindi || defaults.preferredVoices?.Hindi || "",
        Marathi: saved.preferredVoices?.Marathi || defaults.preferredVoices?.Marathi || "",
      },
      voiceSelections: {
        English: {
          female: saved.voiceSelections?.English?.female || "",
          male: saved.voiceSelections?.English?.male || "",
        },
        Hindi: {
          female: saved.voiceSelections?.Hindi?.female || "",
          male: saved.voiceSelections?.Hindi?.male || "",
        },
        Marathi: {
          female: saved.voiceSelections?.Marathi?.female || "",
          male: saved.voiceSelections?.Marathi?.male || "",
        },
      },
    }
    if (user.gender !== "Male" && user.gender !== "Female") {
      user.gender = ""
    }
    return user
  },

  saveUser(user: StoredUser) {
    const key = userScope("signvaani.user_profile", user.email)
    write(key, user)
    // Also update current active user session
    write("signvaani.active_user_email", user.email)
  },

  getActiveUserEmail(): string {
    return read<string>("signvaani.active_user_email", "demo@signvaani.com")
  },

  getTheme(owner = ""): ThemeMode {
    const key = userScope("signvaani.theme", owner)
    return read<ThemeMode>(key, "system")
  },

  saveTheme(theme: ThemeMode, owner = "") {
    const key = userScope("signvaani.theme", owner)
    write(key, theme)
  },

  getRememberedEmail(): string {
    return read<string>("signvaani.remembered_email", "")
  },

  setRememberedEmail(email: string) {
    if (email) {
      write("signvaani.remembered_email", email)
    } else {
      localStorage.removeItem("signvaani.remembered_email")
    }
  },

  // ==========================================
  // Asynchronous Backend Operations (Graceful Offline Fallback)
  // ==========================================

  async fetchPhrasesFromBackend(owner = ""): Promise<SavedPhrase[] | null> {
    try {
      const res = await apiClient.get<SavedPhrase[]>("/phrases", { user_email: owner })
      if (res.isBackendAvailable && res.data && Array.isArray(res.data)) {
        // Cache to localStorage
        this.savePhrases(res.data, owner)
        return res.data
      }
      return null
    } catch {
      return null
    }
  },

  async syncPhraseToBackend(phrase: SavedPhrase, owner = ""): Promise<boolean> {
    try {
      const res = await apiClient.post<SavedPhrase>("/phrases", {
        ...phrase,
        userEmail: owner || phrase.originalText,
      })
      return res.isBackendAvailable && res.data !== null
    } catch {
      return false
    }
  },

  async deletePhraseFromBackend(phraseId: string, owner = ""): Promise<boolean> {
    try {
      const res = await apiClient.delete(`/phrases/${encodeURIComponent(phraseId)}`, { user_email: owner })
      return res.isBackendAvailable && res.data !== null
    } catch {
      return false
    }
  },

  async fetchHistoryFromBackend(owner = ""): Promise<HistoryItem[] | null> {
    try {
      const res = await apiClient.get<HistoryItem[]>("/history", { user_email: owner })
      if (res.isBackendAvailable && res.data && Array.isArray(res.data)) {
        this.saveHistory(res.data, owner)
        return res.data
      }
      return null
    } catch {
      return null
    }
  },

  async syncHistoryItemToBackend(item: HistoryItem, owner = ""): Promise<boolean> {
    try {
      const res = await apiClient.post<HistoryItem>("/history", {
        ...item,
        userEmail: owner,
      })
      return res.isBackendAvailable && res.data !== null
    } catch {
      return false
    }
  },

  async deleteHistoryItemFromBackend(itemId: string, owner = ""): Promise<boolean> {
    try {
      const res = await apiClient.delete(`/history/${encodeURIComponent(itemId)}`, { user_email: owner })
      return res.isBackendAvailable && res.data !== null
    } catch {
      return false
    }
  },

  async clearHistoryOnBackend(owner = ""): Promise<boolean> {
    try {
      const res = await apiClient.delete("/history", { user_email: owner })
      return res.isBackendAvailable && res.data !== null
    } catch {
      return false
    }
  },

  async syncUserPreferencesToBackend(user: StoredUser): Promise<boolean> {
    try {
      const res = await apiClient.put<StoredUser>("/users/preferences", {
        email: user.email,
        preferredLanguage: user.preferredLanguage,
        speechBehaviour: user.speechBehaviour,
        speechRate: user.speechRate,
        showConfidence: user.showConfidence,
        voiceGender: user.voiceGender,
        preferredVoices: user.preferredVoices,
        voiceSelections: user.voiceSelections,
      })
      return res.isBackendAvailable && res.data !== null
    } catch {
      return false
    }
  },
}
