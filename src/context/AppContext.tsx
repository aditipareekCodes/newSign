import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { Language, SavedPhrase, HistoryItem, Screen, CommunicationSource } from "../types"
import { storageService } from "../services/storageService"
import { useAuth } from "./AuthContext"

export interface RegistrationDraft {
  name: string
  email: string
  phone: string
  password: string
}

interface AppContextType {
  screen: Screen
  setScreen: (screen: Screen) => void
  defaultLanguage: Language
  setDefaultLanguage: (lang: Language) => void
  phrases: SavedPhrase[]
  addPhrase: (item: Omit<SavedPhrase, "id" | "createdAt">) => void
  deletePhrase: (id: string) => void
  setPhraseLanguage: (id: string, lang: Language) => void
  history: HistoryItem[]
  recordCommunication: (item: {
    text: string
    translation: string
    language: Language
    confidence?: number
    source: CommunicationSource
  }) => void
  deleteHistoryItem: (id: string) => void
  clearHistory: () => void
  activeWords: string[]
  addWord: (word: string) => void
  removeWord: (index: number) => void
  clearWords: () => void
  setWords: React.Dispatch<React.SetStateAction<string[]>>
  toast: string | null
  notify: (msg: string) => void
  emergencyModalOpen: boolean
  setEmergencyModalOpen: (open: boolean) => void
  registrationDraft: RegistrationDraft | null
  setRegistrationDraft: (draft: RegistrationDraft | null) => void
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export function appendSentenceWord(words: string[], word: string): string[] {
  return [...words, word]
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateSettings } = useAuth()
  const userEmail = user?.email || ""

  const [screen, setScreen] = useState<Screen>(() => {
    return user ? "home" : "login"
  })

  const [defaultLanguage, setDefaultLanguageState] = useState<Language>(() => {
    return user?.preferredLanguage || "English"
  })

  const [phrases, setPhrases] = useState<SavedPhrase[]>(() => {
    return storageService.getPhrases(userEmail)
  })

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    return storageService.getHistory(userEmail)
  })

  const [activeWords, setActiveWords] = useState<string[]>(["I", "NEED"])
  const [toast, setToast] = useState<string | null>(null)
  const [emergencyModalOpen, setEmergencyModalOpen] = useState(false)
  const [registrationDraft, setRegistrationDraft] = useState<RegistrationDraft | null>(null)

  // Synchronize when user changes
  useEffect(() => {
    if (user) {
      setDefaultLanguageState(user.preferredLanguage)
      setPhrases(storageService.getPhrases(user.email))
      setHistory(storageService.getHistory(user.email))

      // Non-blocking background sync with backend if online
      storageService.fetchPhrasesFromBackend(user.email).then((remotePhrases) => {
        if (remotePhrases && remotePhrases.length > 0) {
          setPhrases(remotePhrases)
        }
      })
      storageService.fetchHistoryFromBackend(user.email).then((remoteHistory) => {
        if (remoteHistory) {
          setHistory(remoteHistory)
        }
      })
    }
  }, [user?.email])

  const notify = useCallback((msg: string) => {
    setToast(msg)
    const timer = setTimeout(() => {
      setToast(null)
    }, 2800)
    return () => clearTimeout(timer)
  }, [])

  const setDefaultLanguage = useCallback(
    (lang: Language) => {
      setDefaultLanguageState(lang)
      if (user) {
        updateSettings({ preferredLanguage: lang })
      }
    },
    [user, updateSettings]
  )

  const addPhrase = useCallback(
    (item: Omit<SavedPhrase, "id" | "createdAt">) => {
      const newPhrase: SavedPhrase = {
        ...item,
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `phr_${Date.now()}_${Math.random()}`,
        createdAt: new Date().toISOString(),
      }
      setPhrases((prev) => {
        const next = [newPhrase, ...prev]
        storageService.savePhrases(next, userEmail)
        storageService.syncPhraseToBackend(newPhrase, userEmail)
        return next
      })
      notify("Phrase added to library")
    },
    [userEmail, notify]
  )

  const deletePhrase = useCallback(
    (id: string) => {
      setPhrases((prev) => {
        const next = prev.filter((p) => p.id !== id)
        storageService.savePhrases(next, userEmail)
        storageService.deletePhraseFromBackend(id, userEmail)
        return next
      })
      notify("Phrase removed")
    },
    [userEmail, notify]
  )

  const setPhraseLanguage = useCallback(
    (id: string, lang: Language) => {
      setPhrases((prev) => {
        const next = prev.map((p) => (p.id === id ? { ...p, selectedLanguage: lang } : p))
        storageService.savePhrases(next, userEmail)
        return next
      })
    },
    [userEmail]
  )

  const recordCommunication = useCallback(
    (item: {
      text: string
      translation: string
      language: Language
      confidence?: number
      source: CommunicationSource
    }) => {
      const record: HistoryItem = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `hist_${Date.now()}_${Math.random()}`,
        text: item.text,
        translation: item.translation,
        language: item.language,
        confidence: item.confidence ?? 100,
        createdAt: new Date().toISOString(),
        source: item.source,
      }

      setHistory((prev) => {
        const next = [record, ...prev]
        storageService.saveHistory(next, userEmail)
        storageService.syncHistoryItemToBackend(record, userEmail)
        return next
      })
    },
    [userEmail]
  )

  const deleteHistoryItem = useCallback(
    (id: string) => {
      setHistory((prev) => {
        const next = prev.filter((h) => h.id !== id)
        storageService.saveHistory(next, userEmail)
        storageService.deleteHistoryItemFromBackend(id, userEmail)
        return next
      })
      notify("Item deleted from history")
    },
    [userEmail, notify]
  )

  const clearHistory = useCallback(() => {
    setHistory([])
    storageService.saveHistory([], userEmail)
    storageService.clearHistoryOnBackend(userEmail)
    notify("History cleared")
  }, [userEmail, notify])

  const addWord = useCallback((word: string) => {
    setActiveWords((prev) => appendSentenceWord(prev, word))
  }, [])

  const removeWord = useCallback((index: number) => {
    setActiveWords((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const clearWords = useCallback(() => {
    setActiveWords([])
  }, [])

  return (
    <AppContext.Provider
      value={{
        screen,
        setScreen,
        defaultLanguage,
        setDefaultLanguage,
        phrases,
        addPhrase,
        deletePhrase,
        setPhraseLanguage,
        history,
        recordCommunication,
        deleteHistoryItem,
        clearHistory,
        activeWords,
        addWord,
        removeWord,
        clearWords,
        setWords: setActiveWords,
        toast,
        notify,
        emergencyModalOpen,
        setEmergencyModalOpen,
        registrationDraft,
        setRegistrationDraft,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error("useApp must be used within an AppProvider")
  }
  return context
}
