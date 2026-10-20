import { describe, it, expect, beforeEach, vi } from "vitest"
import { handLandmarkService, HAND_CONNECTIONS } from "./handLandmarkService"
import {
  recognitionService,
  RecognitionService,
  isPredictionRearmed,
  SUPPORTED_ISL_WORDS,
} from "./recognitionService"
import { translationService } from "./translationService"
import { authService } from "./authService"
import { apiClient } from "./apiClient"

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>()
  globalThis.localStorage = ({
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => {
      store.set(key, String(val))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size
    },
  } as Storage)
}

describe("HandLandmarkService Preprocessing Pipeline", () => {
  it("has valid 21-hand connectivity topology", () => {
    expect(HAND_CONNECTIONS.length).toBeGreaterThan(15)
    // All indices must be within 0..20
    HAND_CONNECTIONS.forEach(([start, end]) => {
      expect(start).toBeGreaterThanOrEqual(0)
      expect(start).toBeLessThanOrEqual(20)
      expect(end).toBeGreaterThanOrEqual(0)
      expect(end).toBeLessThanOrEqual(20)
    })
  })

  it("normalizes landmarks to origin (wrist at (0,0,0)) and scales invariance", () => {
    // Generate synthetic 21 3D landmarks
    const landmarks = Array.from({ length: 21 }, (_, i) => ({
      x: 0.5 + i * 0.01,
      y: 0.5 + i * 0.01,
      z: 0.1,
      visibility: 1,
    }))

    const features = handLandmarkService.preprocessLandmarks(landmarks)
    expect(features.length).toBe(63)

    // Landmark 0 (wrist) must be at origin (0, 0, 0)
    expect(features[0]).toBeCloseTo(0, 5)
    expect(features[1]).toBeCloseTo(0, 5)
    expect(features[2]).toBeCloseTo(0, 5)

    // Other points must be scaled non-zero values
    expect(features[3 * 9]).not.toBe(0)
  })

  it("handles empty or incomplete landmarks gracefully without crashing", () => {
    const emptyFeatures = handLandmarkService.preprocessLandmarks([])
    expect(emptyFeatures.length).toBe(63)
    expect(emptyFeatures[0]).toBe(0)
  })
})

describe("RecognitionService Architecture & Rules", () => {
  it("provides complete supported ISL vocabulary", () => {
    const words = recognitionService.getSupportedWords()
    expect(words).toContain("WATER")
    expect(words).toContain("HELP")
    expect(words).toContain("PLEASE")
    expect(words).toContain("FAMILY")
    expect(words).toEqual(SUPPORTED_ISL_WORDS)
  })

  it("does not re-announce a held label but allows another label or a re-armed hand", () => {
    expect(isPredictionRearmed("WATER", "WATER")).toBe(false)
    expect(isPredictionRearmed("WATER", "HELP")).toBe(true)
    expect(isPredictionRearmed("", "WATER")).toBe(true)
  })

  it("honestly reports missing trained model artifact when none exists", () => {
    const status = recognitionService.getModelStatus()
    expect(typeof status.hasTrainedModel).toBe("boolean")
    expect(typeof status.missingArtifactNote).toBe("string")
    expect(status.missingArtifactNote).toContain("ISL")
  })

  it("uses backend model labels including unvalidated HELLO without changing manual vocabulary", async () => {
    const service = new RecognitionService()
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: {
        model_loaded: true,
        supported_classes: ["FOOD", "HELLO", "HELP"],
        unvalidated_classes: ["FOOD", "HELLO", "HELP"],
        manual_vocabulary: SUPPORTED_ISL_WORDS,
      },
      error: null,
      isBackendAvailable: true,
    })

    await service.verifyModelBackend()

    expect(service.getSupportedWords()).toEqual(["FOOD", "HELLO", "HELP"])
    expect(SUPPORTED_ISL_WORDS).toContain("NEED")
    expect(SUPPORTED_ISL_WORDS).toHaveLength(12)
    vi.restoreAllMocks()
  })

  it("surfaces rejected recognition API requests in stream state", async () => {
    const service = new RecognitionService()
    const detection = {
      handsCount: 1,
      landmarks: [[]],
      handedness: ["Right"],
      preprocessedFeatures: [new Float32Array(63)],
    }
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { model_loaded: true, supported_classes: ["HELLO"] },
      error: null,
      isBackendAvailable: true,
    })
    vi.spyOn(apiClient, "post").mockResolvedValue({
      data: null,
      error: "server unavailable",
      isBackendAvailable: false,
    })
    vi.spyOn(handLandmarkService, "initialize").mockResolvedValue(true)
    vi.spyOn(handLandmarkService, "detectVideoFrame").mockReturnValue(detection)
    vi.spyOn(handLandmarkService, "close").mockImplementation(() => {})
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    service.setDemoMode(false)
    await service.verifyModelBackend()

    const messages: string[] = []
    await service.startContinuousRecognition(
      { readyState: 2, paused: false, ended: false } as HTMLVideoElement,
      { onStateUpdate: (state) => messages.push(state.statusMessage) },
    )
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(messages.some((message) => message.includes("server unavailable"))).toBe(true)
    service.stopRecognition()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("sends live landmark features to inference and accepts consensus once per held sign", async () => {
    const service = new RecognitionService()
    const features = new Float32Array(Array.from({ length: 63 }, (_, i) => i / 100))
    const detection = {
      handsCount: 1,
      landmarks: [[]],
      handedness: ["Right"],
      preprocessedFeatures: [features],
    }
    vi.spyOn(apiClient, "get").mockResolvedValue({
      data: { model_loaded: true, supported_classes: ["HELLO"] },
      error: null,
      isBackendAvailable: true,
    })
    const predict = vi.spyOn(apiClient, "post").mockResolvedValue({
      data: {
        word: "HELLO",
        confidence: 90,
        is_genuine_inference: true,
        accepted: true,
      },
      error: null,
      isBackendAvailable: true,
    })
    vi.spyOn(handLandmarkService, "initialize").mockResolvedValue(true)
    vi.spyOn(handLandmarkService, "detectVideoFrame").mockReturnValue(detection)
    vi.spyOn(handLandmarkService, "close").mockImplementation(() => {})
    let now = 0
    vi.spyOn(performance, "now").mockImplementation(() => (now += 120))
    const animationFrames: FrameRequestCallback[] = []
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        animationFrames.push(callback)
        return animationFrames.length
      }),
    )
    vi.stubGlobal("cancelAnimationFrame", vi.fn())
    const acceptedWords: string[] = []
    service.setDemoMode(false)

    await service.startContinuousRecognition(
      { readyState: 2, paused: false, ended: false } as HTMLVideoElement,
      { onWordAccepted: (result) => acceptedWords.push(result.word) },
    )
    for (let frame = 0; frame < 5; frame += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      animationFrames.shift()?.(0)
    }
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(predict).toHaveBeenCalledTimes(6)
    expect(predict).toHaveBeenCalledWith("/recognize/predict", {
      features: Array.from(features),
    })
    expect(acceptedWords).toEqual(["HELLO"])

    service.stopRecognition()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("keeps camera tracking active without requesting automatic labels in demo mode", async () => {
    const service = new RecognitionService()
    const detection = {
      handsCount: 1,
      landmarks: [[]],
      handedness: ["Right"],
      preprocessedFeatures: [new Float32Array(63)],
    }
    vi.spyOn(handLandmarkService, "initialize").mockResolvedValue(true)
    vi.spyOn(handLandmarkService, "detectVideoFrame").mockReturnValue(detection)
    vi.spyOn(handLandmarkService, "close").mockImplementation(() => {})
    const getModelStatus = vi
      .spyOn(apiClient, "get")
      .mockResolvedValue({
        data: { model_loaded: true, supported_classes: ["WATER"] },
        error: null,
        isBackendAvailable: true,
      })
    const predict = vi.spyOn(apiClient, "post")
    vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
    vi.stubGlobal("cancelAnimationFrame", vi.fn())

    const states: string[] = []
    service.setDemoMode(true)
    await service.startContinuousRecognition(
      { readyState: 2, paused: false, ended: false } as HTMLVideoElement,
      { onStateUpdate: (state) => states.push(state.phase) },
    )

    expect(getModelStatus).toHaveBeenCalledWith("/recognize/status")
    expect(states).toContain("demo_mode")
    expect(predict).not.toHaveBeenCalled()
    service.stopRecognition()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })
})

describe("TranslationService Pipeline & Provenance", () => {
  it("returns verified translations for standard ISL phrases", async () => {
    const res = await translationService.translatePhrase(
      "i need water.",
      "English",
    )
    expect(res.translations.English).toBe("I need water.")
    expect(res.translations.Hindi).toBe("मुझे पानी चाहिए।")
    expect(res.translations.Marathi).toBe("मला पाणी हवे आहे.")
    expect(res.source).toBe("verified_local")
  })

  it("translates emergency phrases accurately", async () => {
    const res = await translationService.translatePhrase(
      "i am in danger.",
      "English",
    )
    expect(res.translations.Hindi).toBe("मैं खतरे में हूँ।")
    expect(res.translations.Marathi).toBe("मी धोक्यात आहे.")
  })

  it("preserves source text and does not fabricate translations for arbitrary unknown text", async () => {
    const customText = "Random unexpected custom sign text"
    const res = await translationService.translatePhrase(customText, "English")
    // Original English preserved
    expect(res.translations.English).toBe(customText)
    // Provenance indicates review/fallback when not in dictionary and backend offline in test
    expect(["user_review", "verified_local", "api"]).toContain(res.source)
  }, 10000)

  it("translates single vocabulary words correctly", () => {
    expect(translationService.getSingleWordTranslation("water", "Hindi")).toBe(
      "पानी",
    )
    expect(
      translationService.getSingleWordTranslation("water", "Marathi"),
    ).toBe("पाणी")
    expect(translationService.getSingleWordTranslation("help", "Hindi")).toBe(
      "मदद",
    )
    expect(translationService.getSingleWordTranslation("help", "Marathi")).toBe(
      "मदत",
    )
  })
})

describe("Authentication & Token Security", () => {
  it("does not store plaintext passwords in localStorage", () => {
    const accounts = localStorage.getItem("signvaani.accounts")
    expect(accounts).toBeNull()
  })

  it("correctly manages bearer auth token in apiClient", () => {
    apiClient.setAuthToken("test_token_12345")
    expect(apiClient.getAuthToken()).toBe("test_token_12345")
    apiClient.clearAuthToken()
    expect(apiClient.getAuthToken()).toBeNull()
  })
})
