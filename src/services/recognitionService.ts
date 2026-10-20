/**
 * Genuine Computer Vision & Hand Landmark Extraction Recognition Service
 * 
 * Replaces simulated demo sequences, timers, and randomized jitter
 * with real camera frame extraction, MediaPipe 21 3D hand landmark tracking,
 * scale-invariant preprocessing, duplicate suppression, and genuine model interfaces.
 */

import { NormalizedLandmark } from "@mediapipe/tasks-vision"
import { handLandmarkService, HandDetectionResult } from "./handLandmarkService"
import { apiClient } from "./apiClient"
import { RecognitionResult } from "../types"

export const SUPPORTED_ISL_WORDS = [
  "I",
  "NEED",
  "WATER",
  "HELP",
  "FAMILY",
  "THANK",
  "YOU",
  "HOME",
  "MEDICAL",
  "PLEASE",
  "FOOD",
  "PAIN",
]

export const RECOGNITION_CONFIDENCE_THRESHOLD = 35
export const RECOGNITION_REQUIRED_CONSENSUS = 2

export function isPredictionRearmed(
  previousAcceptedWord: string,
  nextWord: string,
): boolean {
  return previousAcceptedWord !== nextWord
}

export type RecognitionPhase =
  | "idle"
  | "model_loading"
  | "ready"
  | "demo_mode"
  | "no_hand"
  | "multiple_hands"
  | "detecting"
  | "stable"
  | "accepted"
  | "low_confidence"
  | "model_unavailable"

export interface RecognitionDiagnostics {
  rawModelPrediction?: string
  rawModelConfidence?: number
  geometricCandidate?: string | null
  geometricConfidence?: number | null
  finalPrediction?: string
  finalConfidence?: number
  rejectionReason?: string | null
  rawClassProbabilities?: Record<string, number>
  geometricCandidates?: Record<string, number>
}

export interface RecognitionStreamState {
  phase: RecognitionPhase
  candidate: string
  confidence: number
  handsCount: number
  hasTrainedModel: boolean
  missingArtifactNote?: string
  diagnostics?: RecognitionDiagnostics
  statusMessage: string
}

export interface StreamCallbacks {
  onStateUpdate?: (state: RecognitionStreamState) => void
  onWordAccepted?: (result: RecognitionResult) => void
  onLandmarksDetected?: (result: HandDetectionResult) => void
}

export class RecognitionService {
  private isStreaming = false
  private animationFrameId: number | null = null
  private callbacks: StreamCallbacks = {}
  private videoElement: HTMLVideoElement | null = null

  // Prediction stabilization & duplicate suppression state
  private recentPredictions: { word: string; confidence: number }[] = []
  private readonly STABILIZATION_WINDOW = 3
  private readonly MIN_CONFIDENCE_THRESHOLD = RECOGNITION_CONFIDENCE_THRESHOLD
  private lastAcceptedWord = ""
  private noHandSinceTimestamp = 0
  private lastHandsCount = 0
  private demoMode = false

  // Model backend availability
  private hasTrainedModel = false
  private checkedModelEndpoint = false
  private supportedWords: string[] = [...SUPPORTED_ISL_WORDS]
  private missingArtifactNote =
    "ISL neural classification model artifact (.onnx/.joblib/.tflite) is not loaded. Live 21-landmark frame tracking is active."

  // Network inference throttling
  private isInferenceInFlight = false
  private lastInferenceTimestamp = 0
  private readonly INFERENCE_INTERVAL_MS = 120

  public getSupportedWords(): string[] {
    return this.supportedWords
  }

  public setDemoMode(enabled: boolean): void {
    this.demoMode = enabled
    this.recentPredictions = []
    this.lastAcceptedWord = ""
    if (enabled) {
      this.emitState({
        phase: "demo_mode",
        candidate: "",
        confidence: 0,
        handsCount: this.lastHandsCount,
        hasTrainedModel: this.hasTrainedModel,
        statusMessage: "Demo/manual mode: hand tracking only. Choose a word to continue.",
      })
    } else {
      this.emitState({
        phase: "ready",
        candidate: "",
        confidence: 0,
        handsCount: this.lastHandsCount,
        hasTrainedModel: this.hasTrainedModel,
        statusMessage: "Automatic predictions are experimental and may be incorrect.",
      })
    }
  }

  public getModelStatus(): { hasTrainedModel: boolean; missingArtifactNote: string } {
    return {
      hasTrainedModel: this.hasTrainedModel,
      missingArtifactNote: this.missingArtifactNote,
    }
  }

  /**
   * Check backend model availability honestly
   */
  public async verifyModelBackend(force = false): Promise<boolean> {
    if (!force && this.checkedModelEndpoint && this.hasTrainedModel) return this.hasTrainedModel
    try {
      const res = await apiClient.get<{
        model_loaded: boolean
        supported_classes?: string[]
        missing_artifact_explanation?: string
        model_type?: string
        expected_features?: number
        is_valid_estimator?: boolean
        unvalidated_classes?: string[]
        manual_vocabulary?: string[]
      }>("/recognize/status")
      if (res.isBackendAvailable && res.data) {
        this.hasTrainedModel = Boolean(res.data.model_loaded)
        if (res.data.supported_classes && res.data.supported_classes.length > 0) {
          this.supportedWords = res.data.supported_classes
        }
        if (res.data.missing_artifact_explanation) {
          this.missingArtifactNote = res.data.missing_artifact_explanation
        }
        this.checkedModelEndpoint = true
      } else {
        this.hasTrainedModel = false
        if (res.error) {
          this.missingArtifactNote = res.error
        }
        this.checkedModelEndpoint = false
      }
    } catch (err: any) {
      this.hasTrainedModel = false
      this.missingArtifactNote = err?.message || "Could not connect to recognition backend."
      this.checkedModelEndpoint = false
    }
    return this.hasTrainedModel
  }

  /**
   * Start live camera frame extraction and landmark recognition pipeline
   */
  public async startContinuousRecognition(
    video: HTMLVideoElement,
    callbacks: StreamCallbacks
  ): Promise<boolean> {
    if (this.isStreaming) return true

    this.videoElement = video
    this.callbacks = callbacks
    this.isStreaming = true
    this.recentPredictions = []
    this.lastAcceptedWord = ""
    this.noHandSinceTimestamp = 0
    this.lastInferenceTimestamp = 0

    this.emitState({
      phase: "model_loading",
      candidate: "",
      confidence: 0,
      handsCount: 0,
      hasTrainedModel: this.hasTrainedModel,
      statusMessage: "Initializing MediaPipe Hand Landmarker...",
    })

    // Check backend model status fresh
    await this.verifyModelBackend(true).catch(() => {})

    // Initialize MediaPipe detector
    const ready = await handLandmarkService.initialize()
    if (!ready) {
      const err = handLandmarkService.getInitError() || "Failed to load hand landmark detector."
      this.isStreaming = false
      this.emitState({
        phase: "model_unavailable",
        candidate: "",
        confidence: 0,
        handsCount: 0,
        hasTrainedModel: false,
        missingArtifactNote: err,
        statusMessage: `MediaPipe Error: ${err}`,
      })
      return false
    }

    // Start video frame processing loop
    this.processFrameLoop()
    return true
  }

  /**
   * Animation frame processing loop extracting live camera frames
   */
  private processFrameLoop = () => {
    if (!this.isStreaming || !this.videoElement) return

    const now = performance.now()
    const detection = handLandmarkService.detectVideoFrame(this.videoElement, now)

    if (detection) {
      this.callbacks.onLandmarksDetected?.(detection)
      this.handleDetection(detection, now)
    } else {
      if (this.videoElement.readyState < 2) {
        this.emitState({
          phase: "ready",
          candidate: "",
          confidence: 0,
          handsCount: 0,
          hasTrainedModel: this.hasTrainedModel,
          statusMessage: "Camera frame stream warming up...",
        })
      } else {
        this.emitState({
          phase: "low_confidence",
          candidate: "",
          confidence: 0,
          handsCount: this.lastHandsCount,
          hasTrainedModel: this.hasTrainedModel,
          missingArtifactNote: this.missingArtifactNote,
          statusMessage:
            "The hand-landmark detector could not process this camera frame. Restart recognition if this continues.",
        })
      }
    }

    this.animationFrameId = requestAnimationFrame(this.processFrameLoop)
  }

  /**
   * Handle real-time hand detection results
   */
  private handleDetection(detection: HandDetectionResult, timestamp: number) {
    const { handsCount, landmarks, preprocessedFeatures } = detection
    this.lastHandsCount = handsCount

    // 1. No Hands Detected
    if (handsCount === 0) {
      this.recentPredictions = []
      if (!this.noHandSinceTimestamp) {
        this.noHandSinceTimestamp = timestamp
      }

      // If hand was out of frame for > 700ms, reset duplicate suppression memory
      if (timestamp - this.noHandSinceTimestamp > 700) {
        this.lastAcceptedWord = ""
      }

      this.emitState({
        phase: "no_hand",
        candidate: "",
        confidence: 0,
        handsCount: 0,
        hasTrainedModel: this.hasTrainedModel,
        statusMessage: "No hand detected. Position your hand in the guide frame.",
      })
      return
    }

    // Hand is present; reset no-hand timer
    this.noHandSinceTimestamp = 0

    if (this.demoMode) {
      this.recentPredictions = []
      this.emitState({
        phase: "demo_mode",
        candidate: "",
        confidence: 0,
        handsCount,
        hasTrainedModel: this.hasTrainedModel,
        statusMessage: "Demo/manual mode: hand tracking only. Choose a word manually.",
      })
      return
    }

    // 2. Select Active Signing Hand (Supports 1 or 2 hands without blocking!)
    let features: Float32Array = preprocessedFeatures[0]
    if (handsCount > 1 && preprocessedFeatures.length > 1) {
      const hand0 = preprocessedFeatures[0]
      const hand1 = preprocessedFeatures[1]
      features = hand0 && hand0.length === 63 ? hand0 : hand1
    }

    if (!features || features.length !== 63) {
      this.emitState({
        phase: "low_confidence",
        candidate: "",
        confidence: 0,
        handsCount,
        hasTrainedModel: this.hasTrainedModel,
        statusMessage:
          "The hand detector returned invalid landmarks. Reposition your hand or restart recognition.",
      })
      return
    }

    // If no trained classification model weights exist:
    // Honestly report landmark tracking without fabricating predictions!
    if (!this.hasTrainedModel) {
      this.emitState({
        phase: "model_unavailable",
        candidate: "",
        confidence: 0,
        handsCount,
        hasTrainedModel: false,
        missingArtifactNote: this.missingArtifactNote,
        statusMessage: `Hand landmarks detected, but automatic recognition is unavailable: ${this.missingArtifactNote}`,
      })
      return
    }

    // If trained model is present, query inference asynchronously
    this.runModelInference(features, timestamp, handsCount, preprocessedFeatures)
  }

  /**
   * Executes genuine model inference and stabilizes predictions
   */
  private async runModelInference(
    features: Float32Array,
    timestamp: number,
    handsCount: number = 1,
    allHandFeatures: Float32Array[] = []
  ) {
    if (
      this.isInferenceInFlight ||
      timestamp - this.lastInferenceTimestamp < this.INFERENCE_INTERVAL_MS
    ) {
      return
    }
    this.isInferenceInFlight = true
    this.lastInferenceTimestamp = timestamp

    try {
      const featureArray = Array.from(features)
      const res = await apiClient.post<{
        word: string
        confidence: number
        is_genuine_inference: boolean
        diagnostics?: {
          raw_model_prediction?: string
          raw_model_conf?: number
          raw_model_confidence?: number
          geometric_candidate?: string | null
          geometric_confidence?: number | null
          geom_candidates?: Record<string, number>
          final_prediction?: string
          final_conf?: number
          final_confidence?: number
          rejection_reason?: string | null
          raw_class_probabilities?: Record<string, number>
          geometry_usage?: string
          class_validation?: string
        }
        accepted?: boolean
        rejection_reason?: string | null
      }>("/recognize/predict", { features: featureArray })

      if (!res.isBackendAvailable) {
        this.emitState({
          phase: "low_confidence",
          candidate: "",
          confidence: 0,
          handsCount,
          hasTrainedModel: false,
          statusMessage: res.error
            ? `Recognition server offline: ${res.error}`
            : "Recognition server offline. Choose words manually.",
        })
        return
      }

      if (!res.data) {
        this.emitState({
          phase: "low_confidence",
          candidate: "",
          confidence: 0,
          handsCount,
          hasTrainedModel: true,
          statusMessage: res.error || "Inference error from server. Choose words manually.",
        })
        return
      }

      const { word, confidence, diagnostics } = res.data
      const mappedDiagnostics: RecognitionDiagnostics | undefined = diagnostics
        ? {
            rawModelPrediction: diagnostics.raw_model_prediction,
            rawModelConfidence:
              diagnostics.raw_model_confidence ?? diagnostics.raw_model_conf,
            geometricCandidate: diagnostics.geometric_candidate,
            geometricConfidence: diagnostics.geometric_confidence,
            finalPrediction: diagnostics.final_prediction ?? word,
            finalConfidence:
              diagnostics.final_confidence ?? diagnostics.final_conf ?? confidence,
            rejectionReason:
              diagnostics.rejection_reason ?? res.data.rejection_reason,
            rawClassProbabilities: diagnostics.raw_class_probabilities,
            geometricCandidates: diagnostics.geom_candidates,
          }
        : undefined
      if (mappedDiagnostics && import.meta.env.DEV) {
        console.debug("[Recognition Diagnostic]", {
          raw: mappedDiagnostics.rawModelPrediction,
          rawScore: mappedDiagnostics.rawModelConfidence,
          geometricCandidate: mappedDiagnostics.geometricCandidate,
          geometricScore: mappedDiagnostics.geometricConfidence,
          classProbabilities: mappedDiagnostics.rawClassProbabilities,
          geometricCandidates: mappedDiagnostics.geometricCandidates,
          final: mappedDiagnostics.finalPrediction,
          finalScore: mappedDiagnostics.finalConfidence,
          rejectionReason: mappedDiagnostics.rejectionReason,
        })
      }

      const supportedWord = this.supportedWords.includes(word)
      if (res.data.accepted === false || !supportedWord) {
        this.recentPredictions = []
        const reason =
          diagnostics?.rejection_reason ?? res.data.rejection_reason
        this.emitState({
          phase: "low_confidence",
          candidate: "",
          confidence: 0,
          handsCount,
          hasTrainedModel: true,
          diagnostics: mappedDiagnostics,
          statusMessage: reason
            ? `Gesture unclear: ${reason}`
            : "Gesture unclear. Try again or choose a word manually.",
        })
        return
      }

      // This score threshold is a conservative UI filter; it is not a
      // measure of accuracy on unseen signers or real-world webcam input.
      if (confidence < this.MIN_CONFIDENCE_THRESHOLD) {
        this.recentPredictions = []
        this.emitState({
          phase: "low_confidence",
          candidate: "",
          confidence: 0,
          handsCount,
          hasTrainedModel: true,
          diagnostics: mappedDiagnostics,
          statusMessage:
            mappedDiagnostics?.rejectionReason ??
            "Gesture unclear. Try again or choose a word manually.",
        })
        return
      }

      // Add to stabilization window
      this.recentPredictions.push({ word, confidence })
      if (this.recentPredictions.length > this.STABILIZATION_WINDOW) {
        this.recentPredictions.shift()
      }

      // Check consensus in stabilization window
      const agreementCount = this.recentPredictions.filter((p) => p.word === word).length
      const avgConfidence = Math.round(
        this.recentPredictions.reduce((sum, p) => sum + p.confidence, 0) /
          this.recentPredictions.length
      )

      if (agreementCount >= 2) {
        const isDuplicate = !isPredictionRearmed(this.lastAcceptedWord, word)

        if (agreementCount >= RECOGNITION_REQUIRED_CONSENSUS && !isDuplicate) {
          // Gesture confirmed and accepted!
          this.lastAcceptedWord = word
          this.recentPredictions = []

          this.emitState({
            phase: "accepted",
            candidate: word,
            confidence: avgConfidence,
            handsCount,
            hasTrainedModel: true,
            diagnostics: mappedDiagnostics,
            statusMessage: `Gesture Accepted: "${word}" (${avgConfidence}%)`,
          })

          this.callbacks.onWordAccepted?.({
            word,
            confidence: avgConfidence,
          })
        } else {
          // Stable but waiting for confirmation or duplicate suppressed
          this.emitState({
            phase: "stable",
            candidate: word,
            confidence: avgConfidence,
            handsCount,
            hasTrainedModel: true,
            diagnostics: mappedDiagnostics,
            statusMessage: isDuplicate
              ? `Holding "${word}" (Already added)`
              : `Stable Sign: "${word}"`,
          })
        }
      } else {
        // Detecting phase
        this.emitState({
          phase: "detecting",
          candidate: word,
          confidence: Math.round(confidence),
          handsCount,
          hasTrainedModel: true,
          diagnostics: mappedDiagnostics,
          statusMessage: `Detecting gesture: "${word}"...`,
        })
      }
    } catch (err: unknown) {
      this.emitState({
        phase: "low_confidence",
        candidate: "",
        confidence: 0,
        handsCount,
        hasTrainedModel: true,
        statusMessage:
          err instanceof Error
            ? `Recognition request failed: ${err.message}`
            : "Recognition request failed. Choose a word manually.",
      })
    } finally {
      this.isInferenceInFlight = false
    }
  }

  private emitState(state: RecognitionStreamState) {
    this.callbacks.onStateUpdate?.(state)
  }

  /**
   * Pause real-time recognition frame loop
   */
  public pauseRecognition() {
    this.isStreaming = false
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.recentPredictions = []
    this.lastAcceptedWord = ""
    this.noHandSinceTimestamp = 0
    this.emitState({
      phase: "idle",
      candidate: "",
      confidence: 0,
      handsCount: 0,
      hasTrainedModel: this.hasTrainedModel,
      statusMessage: "Recognition paused",
    })
  }

  /**
   * Stop recognition and release resources cleanly
   */
  public stopRecognition() {
    this.pauseRecognition()
    this.videoElement = null
    this.callbacks = {}
    this.lastHandsCount = 0
    this.lastAcceptedWord = ""
    this.noHandSinceTimestamp = 0
    this.lastInferenceTimestamp = 0
    handLandmarkService.close()
  }
}

export const recognitionService = new RecognitionService()
