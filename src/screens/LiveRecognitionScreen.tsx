import React, { useState, useRef, useEffect, useCallback } from "react"
import { useApp } from "../context/AppContext"
import { useAuth } from "../context/AuthContext"
import {
  recognitionService,
  RecognitionStreamState,
  SUPPORTED_ISL_WORDS,
} from "../services/recognitionService"
import { handLandmarkService } from "../services/handLandmarkService"
import { speechService } from "../services/speechService"
import { translationService } from "../services/translationService"
import {
  requestCameraStream,
  isSecureCameraContext,
  getLocalhostUrl,
  getCameraDiagnosticMessage,
} from "../services/cameraUtils"
import {
  CameraIcon,
  StopIcon,
  PlayIcon,
  PauseIcon,
  PlusIcon,
  XIcon,
  SearchIcon,
  AlertIcon,
  CheckIcon,
  WaveformIcon,
} from "../components/Icons"
import { PageHeader } from "../components/PageHeader"
import { PrimaryButton } from "../components/PrimaryButton"
import { Modal } from "../components/Modal"
import { StatusBadge } from "../components/StatusBadge"
import { LanguageSelector } from "../components/LanguageSelector"

export const LiveRecognitionScreen: React.FC = () => {
  const {
    setScreen,
    activeWords,
    addWord,
    removeWord,
    defaultLanguage,
    setDefaultLanguage,
    recordCommunication,
    notify,
  } = useApp()
  const { user, updateSettings } = useAuth()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [cameraActive, setCameraActive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [demoMode, setDemoMode] = useState(() => {
    try {
      return window.localStorage.getItem("signvaani.recognition.mode") === "manual"
    } catch {
      return false
    }
  })
  const [autoSpeak, setAutoSpeak] = useState(() => {
    try {
      const stored = window.localStorage.getItem("signvaani.recognition.autospeak")
      if (stored !== null) return stored === "true"
      return true
    } catch {
      return true
    }
  })

  // Live recognition stream state
  const [streamState, setStreamState] = useState<RecognitionStreamState>({
    phase: "idle",
    candidate: "",
    confidence: 0,
    handsCount: 0,
    hasTrainedModel: false,
    statusMessage: "Camera ready. Start recognition to begin tracking.",
  })

  const [manualPickerOpen, setManualPickerOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Stop camera tracks and release recognition resources cleanly on unmount
  useEffect(() => {
    return () => {
      recognitionService.stopRecognition()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [])

  // Sync canvas size with video when video metadata loads
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current && canvasRef.current) {
      canvasRef.current.width = videoRef.current.videoWidth || 640
      canvasRef.current.height = videoRef.current.videoHeight || 480
    }
  }

  const toggleDemoMode = () => {
    const nextDemoMode = !demoMode
    setDemoMode(nextDemoMode)
    recognitionService.setDemoMode(nextDemoMode)
    try {
      window.localStorage.setItem(
        "signvaani.recognition.mode",
        nextDemoMode ? "manual" : "automatic",
      )
    } catch (err) {
      console.warn("Unable to persist recognition mode:", err)
      notify("Recognition mode changed for this screen, but could not be saved.")
      return
    }
    notify(
      nextDemoMode
        ? "Demo/manual mode enabled. Automatic labels are disabled."
        : "Automatic recognition enabled. Predictions may be incorrect.",
    )
  }

  // Guarantee video element receives stream whenever cameraActive changes
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current
        videoRef.current.play().catch((err) => console.warn("Video play error in effect:", err))
      }
    }
  }, [cameraActive])

  const startRecognitionLoop = async (video: HTMLVideoElement) => {
    setIsRecognizing(true)
    recognitionService.setDemoMode(demoMode)

    const ok = await recognitionService.startContinuousRecognition(video, {
      onStateUpdate: setStreamState,
      onWordAccepted: (result) => {
        addWord(result.word)
        notify(`Recognized gesture: "${result.word}"`)

        const spokenText = translationService.getSingleWordTranslation(
          result.word,
          defaultLanguage,
        )
        if (autoSpeak) {
          const voiceGender = user?.voiceGender || "female"
          const preferredVoice = user?.preferredVoices?.[defaultLanguage] || ""
          const rate = user?.speechRate || 1.0

          speechService.speak(
            spokenText,
            defaultLanguage,
            rate,
            preferredVoice,
            voiceGender,
            user?.voiceSelections,
            {
              onStart: () => {
                recordCommunication({
                  text: result.word,
                  translation: spokenText,
                  language: defaultLanguage,
                  confidence: result.confidence,
                  source: "recognition",
                })
              },
              onError: (error) => notify(`Automatic speech unavailable: ${error}`),
              onVoiceWarning: (warning) =>
                notify(`Automatic speech unavailable: ${warning}`),
            },
          )
        } else {
          recordCommunication({
            text: result.word,
            translation: spokenText,
            language: defaultLanguage,
            confidence: result.confidence,
            source: "recognition",
          })
        }
      },
      onLandmarksDetected: (detection) => {
        if (!canvasRef.current) return
        const ctx = canvasRef.current.getContext("2d")
        if (ctx) {
          handLandmarkService.drawLandmarks(
            ctx,
            detection.landmarks,
            canvasRef.current.width,
            canvasRef.current.height,
            true,
          )
        }
      },
    })

    if (!ok) setIsRecognizing(false)
  }

  const startCamera = async () => {
    setCameraError(null)
    setStreamState({
      phase: "model_loading",
      candidate: "",
      confidence: 0,
      handsCount: 0,
      hasTrainedModel: false,
      statusMessage: "Starting camera and initializing recognition...",
    })
    try {
      const stream = await requestCameraStream({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      streamRef.current = stream
      setCameraActive(true)
      const video = videoRef.current
      if (!video) throw new Error("Camera preview is unavailable.")
      video.srcObject = stream
      try {
        await video.play()
      } catch (playErr) {
        throw new Error(
          `Camera stream opened, but the live preview could not start: ${
            playErr instanceof Error ? playErr.message : String(playErr)
          }`,
        )
      }
      notify("Camera connected successfully")
      await startRecognitionLoop(video)
    } catch (err: any) {
      recognitionService.stopRecognition()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (videoRef.current) videoRef.current.srcObject = null
      const msg =
        err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError"
          ? "Camera permission denied in Edge. Click the lock or camera icon in the Edge address bar and set to 'Allow'. Also ensure Windows Settings > Privacy & security > Camera has camera access enabled."
          : err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError"
          ? "No camera found on this device. Please connect a webcam."
          : err?.name === "NotReadableError" || err?.name === "TrackStartError"
          ? "Camera is already in use by another application (e.g. Zoom, Teams, or another browser tab). Close it and retry."
          : err?.message || "Camera device unavailable or disconnected."
      setCameraError(msg)
      setCameraActive(false)
      setIsRecognizing(false)
      setStreamState({
        phase: "model_unavailable",
        candidate: "",
        confidence: 0,
        handsCount: 0,
        hasTrainedModel: false,
        statusMessage: msg,
      })
      notify(msg)
    }
  }

  const stopCamera = useCallback(() => {
    recognitionService.stopRecognition()
    setIsRecognizing(false)

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }

    setCameraActive(false)
    setStreamState((prev) => ({
      ...prev,
      phase: "idle",
      handsCount: 0,
      confidence: 0,
      hasTrainedModel: false,
      statusMessage: "Camera offline",
    }))
  }, [])

  const startContinuousRecognition = async () => {
    if (!cameraActive || !videoRef.current || !streamRef.current) {
      notify("Please enable the camera first.")
      return
    }

    await startRecognitionLoop(videoRef.current)
  }

  const pauseRecognition = () => {
    recognitionService.pauseRecognition()
    setIsRecognizing(false)
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }

  const filteredVocabulary = SUPPORTED_ISL_WORDS.filter((w) =>
    w.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const showConfidenceScore = user?.showConfidence ?? true

  // Derive badge status
  const getBadgeType = (): "success" | "info" | "warning" | "emergency" | "neutral" => {
    switch (streamState.phase) {
      case "accepted":
        return "success"
      case "stable":
        return "info"
      case "low_confidence":
      case "multiple_hands":
        return "warning"
      case "model_unavailable":
        return "warning"
      case "detecting":
        return "info"
      default:
        return "neutral"
    }
  }

  const getBadgeLabel = (): string => {
    switch (streamState.phase) {
      case "model_loading":
        return "Loading MediaPipe..."
      case "demo_mode":
        return "Demo / Manual Mode"
      case "no_hand":
        return "No Hand in Frame"
      case "multiple_hands":
        return "Multiple Hands Detected"
      case "detecting":
        return streamState.hasTrainedModel ? "Detecting Sign..." : "Landmark Tracking Active"
      case "stable":
        return "Stable Sign"
      case "accepted":
        return "Sign Accepted"
      case "low_confidence":
        return "Low Confidence"
      case "model_unavailable":
        return "Detector Unavailable"
      case "idle":
        return cameraActive ? "Camera Ready" : "Camera Offline"
      default:
        return "Ready"
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <PageHeader
        title={
          defaultLanguage === "Hindi"
            ? "लाइव साइन रिकग्निशन"
            : defaultLanguage === "Marathi"
            ? "थेट सांकेतिक भाषा ओळख"
            : "Live Sign Recognition"
        }
        subtitle={
          defaultLanguage === "Hindi"
            ? "गाइड बॉक्स में हाथ के संकेत स्पष्ट रखें"
            : defaultLanguage === "Marathi"
            ? "मार्गदर्शक चौकटीत हाताचे संकेत स्पष्ट ठेवा"
            : "Frame hand signs clearly in the guide box with real-time landmark tracking"
        }
        onBack={() => {
          stopCamera()
          setScreen("home")
        }}
        action={
          <div className="hidden sm:block">
            <LanguageSelector
              selected={defaultLanguage}
              onChange={setDefaultLanguage}
              size="sm"
            />
          </div>
        }
      />

      {/* Main recognition stage: 2-column on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Dark Camera Viewport (Col 7 on desktop) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-[#0A1124] border-2 border-[var(--border-color)] shadow-2xl flex items-center justify-center">
            {/* Live video feed and Landmark Canvas Overlay (always in DOM) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={handleVideoLoadedMetadata}
              className={`w-full h-full object-cover transform -scale-x-100 ${
                cameraActive ? "block" : "hidden"
              }`}
            />
            {/* Canvas Overlay for 21 3D hand landmarks skeleton */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${
                cameraActive ? "block" : "hidden"
              }`}
            />

            {!cameraActive && (
              <div className="flex flex-col items-center justify-center p-6 text-center text-white/70 space-y-3 z-10 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                  <CameraIcon size={32} color="white" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-base text-white">Camera Offline</p>
                  <p className="text-xs text-white/70 max-w-sm">
                    {cameraError ||
                      "Enable your camera for real-time MediaPipe hand landmark tracking and gesture recognition."}
                  </p>
                </div>

                {!isSecureCameraContext() && (
                  <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-3 text-xs text-amber-200 text-center space-y-1 w-full">
                    <p className="font-semibold text-amber-100">⚠️ Insecure Context in Edge</p>
                    <p className="text-[11px] text-amber-200/90">
                      Edge disables the Camera API on network IP addresses ({window.location.hostname}). Open localhost to enable camera access.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = getLocalhostUrl()
                      }}
                      className="mt-1 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold rounded-lg transition text-xs cursor-pointer"
                    >
                      Open http://localhost:{window.location.port || "5173"}
                    </button>
                  </div>
                )}

                <PrimaryButton
                  variant="primary"
                  size="sm"
                  onClick={startCamera}
                  icon={<CameraIcon size={16} />}
                >
                  Enable Camera
                </PrimaryButton>
              </div>
            )}

            {/* Hand Position Guide Outline (floating overlay) */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-8">
              <div
                className={`w-44 h-56 sm:w-56 sm:h-64 rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-between p-3 ${
                  streamState.phase === "accepted"
                    ? "border-[var(--color-success)] bg-[var(--color-success)]/10 shadow-[0_0_30px_rgba(58,143,118,0.5)]"
                    : streamState.phase === "stable"
                    ? "border-[var(--color-aqua)] bg-[var(--color-aqua)]/10"
                    : streamState.handsCount > 0
                    ? "border-emerald-400/80 bg-emerald-500/5 shadow-[0_0_20px_rgba(16,185,129,0.2)]"
                    : "border-white/40 bg-white/5"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/90 bg-black/60 px-2 py-0.5 rounded-md backdrop-blur-md">
                  {streamState.handsCount > 0 ? "Hand in Frame" : "Hand Frame Guide"}
                </span>

                {/* Center pulse icon if no hand */}
                {streamState.handsCount === 0 && (
                  <div className="opacity-40">
                    <div className="w-12 h-12 rounded-full border border-white/60 animate-ping" />
                  </div>
                )}

                <span className="text-[10px] text-white/80 font-medium bg-black/40 px-2 py-0.5 rounded backdrop-blur-sm">
                  {streamState.handsCount > 0
                    ? "21 Landmarks Tracked"
                    : "Keep hand within frame"}
                </span>
              </div>
            </div>

            {/* Floating Glass Top Bar */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-md border ${
                    cameraActive
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-black/60 text-white/70 border-white/20"
                  }`}
                >
                  {cameraActive ? "Camera Active" : "Camera Off"}
                </span>

                {cameraActive && (
                  <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black/60 text-white/80 border border-white/20 backdrop-blur-md hidden sm:inline-block">
                    {streamState.handsCount > 0
                      ? `${streamState.handsCount} Hand Active (21 Landmarks)`
                      : "No Hand in View"}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    const nextMode = !autoSpeak
                    setAutoSpeak(nextMode)
                    try {
                      window.localStorage.setItem("signvaani.recognition.autospeak", String(nextMode))
                    } catch {}
                    updateSettings({ speechBehaviour: nextMode ? "auto" : "confirm" })
                    notify(`Speech mode: ${nextMode ? "Auto Speak: ON (Speaking as recognized)" : "Confirm First (Manual confirmation)"}`)
                  }}
                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-md transition-all cursor-pointer flex items-center gap-1 ${
                    autoSpeak
                      ? "bg-sky-500/30 text-sky-200 border-sky-400/50 shadow-sm"
                      : "bg-black/60 text-white/70 border-white/20 hover:text-white"
                  }`}
                  title="Toggle between Auto Speak and Confirm First speech mode"
                >
                  <WaveformIcon size={11} color="currentColor" />
                  <span>{autoSpeak ? "Auto Speak: ON" : "Confirm First"}</span>
                </button>
              </div>

              {/* Status Badge */}
              <div className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-bold text-white flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRecognizing
                      ? streamState.handsCount > 0
                        ? "bg-emerald-400 animate-pulse"
                        : "bg-amber-400"
                      : "bg-white/40"
                  }`}
                />
                <span>{getBadgeLabel()}</span>
              </div>
            </div>

            {/* Floating Glass Bottom Controls */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-auto">
              <div className="flex items-center gap-2">
                {cameraActive ? (
                  <button
                    onClick={stopCamera}
                    className="glass-panel px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 hover:bg-white/20 transition-all cursor-pointer"
                  >
                    <StopIcon size={14} />
                    <span>Stop Camera</span>
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    className="glass-panel px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 hover:bg-white/20 transition-all cursor-pointer"
                  >
                    <CameraIcon size={14} />
                    <span>Start Camera</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setManualPickerOpen(true)}
                  className="glass-panel px-3 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 hover:bg-white/20 transition-all cursor-pointer"
                >
                  <PlusIcon size={14} />
                  <span>Choose Word</span>
                </button>
              </div>
            </div>
          </div>

          {/* Primary Recognition Trigger Bar */}
          <div className="flex items-center gap-3">
            {!isRecognizing ? (
              <PrimaryButton
                variant="primary"
                size="lg"
                fullWidth
                disabled={!cameraActive}
                onClick={startContinuousRecognition}
                icon={<PlayIcon size={18} />}
              >
                Start Continuous Recognition
              </PrimaryButton>
            ) : (
              <PrimaryButton
                variant="secondary"
                size="lg"
                fullWidth
                onClick={pauseRecognition}
                icon={<PauseIcon size={18} />}
              >
                Pause Recognition
              </PrimaryButton>
            )}
          </div>
        </div>

        {/* Live Detection Panel & Word Tray (Col 5 on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Honest Model Status Notice if no trained weights artifact */}
          {!streamState.hasTrainedModel && !demoMode && isRecognizing && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertIcon size={16} />
                <span>
                  {streamState.phase === "model_unavailable"
                    ? "Automatic recognition unavailable"
                    : "Connecting to recognition model"}
                </span>
              </div>
              <p className="leading-relaxed opacity-90">
                {streamState.missingArtifactNote ||
                  "The recognition backend has not reported a loaded model."}
              </p>
              <p className="leading-relaxed font-semibold">
                Use <b>"Choose Word"</b> to assemble vocabulary words into sentences without fabricated predictions.
              </p>
            </div>
          )}

          {demoMode && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <AlertIcon size={16} />
                <span>Presentation-safe demo mode is on</span>
              </div>
              <p className="leading-relaxed">
                Camera hand tracking remains active, but automatic word predictions are disabled.
                Use “Choose Word” for the presentation; the experimental classifier has not been
                validated on real webcam performances.
              </p>
            </div>
          )}

          {/* Real-time Recognition Status Card */}
          <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Current Detection
              </span>
              <StatusBadge
                status={getBadgeType()}
                label={getBadgeLabel()}
                pulse={isRecognizing && streamState.handsCount > 0}
              />
            </div>

            <div className="flex items-center justify-between gap-4 py-2">
              <div className="space-y-1 min-w-0">
                <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-main)] truncate" aria-live="polite">
                  {streamState.candidate ||
                    (streamState.handsCount > 0 ? "Hand Tracked" : "No Hand Detected")}
                </div>
                <div className="text-xs font-semibold text-[var(--color-primary)]">
                  {demoMode
                    ? "Manual vocabulary selection"
                    : streamState.hasTrainedModel
                    ? "Experimental classifier output (unvalidated)"
                    : streamState.handsCount > 0
                    ? "21 Landmark Keypoints Extracted"
                    : "Position Hand in Guide"}
                </div>
              </div>

              {/* Confidence Ring if model or landmark tracking active */}
              {showConfidenceScore && streamState.confidence > 0 && (
                <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                  <svg className="w-16 h-16 -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="var(--border-subtle)"
                      strokeWidth="5"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="26"
                      stroke="var(--color-primary)"
                      strokeWidth="5"
                      strokeDasharray={163.36}
                      strokeDashoffset={163.36 * (1 - streamState.confidence / 100)}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-300 ease-out"
                    />
                  </svg>
                  <span className="absolute font-extrabold text-xs text-[var(--text-main)]">
                    {streamState.confidence}%
                  </span>
                </div>
              )}
            </div>

            {/* Status Message */}
            <div className="p-2.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)]">
              {streamState.statusMessage}
            </div>

            <button
              type="button"
              onClick={toggleDemoMode}
              aria-pressed={demoMode}
              className={`w-full rounded-xl border px-3 py-2.5 text-xs font-bold transition-colors cursor-pointer ${
                demoMode
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "border-[var(--border-color)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]"
              }`}
            >
              {demoMode
                ? "Demo/manual mode: ON — turn off for experimental predictions"
                : "Demo/manual mode: OFF — turn on to disable automatic predictions"}
            </button>

            {demoMode && (
                <button
                  type="button"
                  onClick={() => setManualPickerOpen(true)}
                  className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--surface-primary)] px-3 py-2.5 text-xs font-bold text-[var(--text-main)] transition-colors hover:bg-[var(--surface-elevated)] cursor-pointer"
                >
                  Choose a word manually
                </button>
            )}

            {import.meta.env.DEV && !demoMode && streamState.diagnostics && (
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3 text-xs text-[var(--text-secondary)] space-y-1">
                <div className="font-bold text-[var(--text-main)]">
                  Development diagnostics (scores are not validated accuracy)
                </div>
                <div>
                  Raw classifier: {streamState.diagnostics.rawModelPrediction || "unavailable"}
                  {streamState.diagnostics.rawModelConfidence !== undefined &&
                    ` (${streamState.diagnostics.rawModelConfidence}%)`}
                </div>
                <div>
                  Geometric candidate: {streamState.diagnostics.geometricCandidate || "none"}
                  {streamState.diagnostics.geometricConfidence !== undefined &&
                    streamState.diagnostics.geometricConfidence !== null &&
                    ` (${streamState.diagnostics.geometricConfidence}%)`}
                </div>
                <div>
                  Final result: {streamState.diagnostics.finalPrediction || "unavailable"}
                  {streamState.diagnostics.finalConfidence !== undefined &&
                    ` (${streamState.diagnostics.finalConfidence}%)`}
                </div>
                {streamState.diagnostics.rejectionReason && (
                  <div>Rejected: {streamState.diagnostics.rejectionReason}</div>
                )}
              </div>
            )}

            {/* Manual add if candidate exists */}
            {streamState.candidate && (
              <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  onClick={() => {
                    addWord(streamState.candidate)
                    notify(`Added "${streamState.candidate}" to sentence`)
                  }}
                  className="btn-tactile flex-1 py-2.5 rounded-xl bg-[var(--surface-soft-blue)] text-[var(--color-primary)] text-xs font-bold hover:bg-[var(--color-primary)] hover:text-white transition-all cursor-pointer"
                >
                  + Add "{streamState.candidate}"
                </button>
              </div>
            )}
          </div>

          {/* Hand Pose Reference Guide */}
          <div className="p-4 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Hand Pose Guide
              </span>
              <span className="text-[10px] text-[var(--color-primary)] font-semibold">
                Hold pose steady in camera
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">🖐️ HELLO</span>
                <span className="text-[10px] text-[var(--text-secondary)]">5 fingers spread wide</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">🫵 YOU</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Index pointing at camera</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">☝️ I</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Index pointing straight UP</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">🤟 WATER</span>
                <span className="text-[10px] text-[var(--text-secondary)]">'W' sign (3 middle fingers)</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">👍 HELP</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Thumbs-Up fist</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">🤌 FOOD</span>
                <span className="text-[10px] text-[var(--text-secondary)]">All fingertips pinched</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">✋ THANK</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Flat hand (4 fingers shut)</span>
              </div>
              <div className="p-2 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] space-y-0.5">
                <span className="font-extrabold text-[var(--text-main)] block">🫲 PLEASE</span>
                <span className="text-[10px] text-[var(--text-secondary)]">Flat open palm</span>
              </div>
            </div>
          </div>

          {/* Word Tray (accumulated words) */}
          <div className="p-5 rounded-3xl bg-[var(--surface-primary)] border border-[var(--border-color)] shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
                Recognized Words ({activeWords.length})
              </span>
              {activeWords.length > 0 && (
                <button
                  onClick={() => removeWord(activeWords.length - 1)}
                  className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--color-emergency)] cursor-pointer"
                >
                  Undo last
                </button>
              )}
            </div>

            {/* Words chip flow */}
            {activeWords.length > 0 ? (
              <div className="flex flex-wrap gap-2 min-h-[48px] p-2 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)]">
                {activeWords.map((word, idx) => (
                  <span
                    key={`${word}-${idx}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--surface-primary)] border border-[var(--border-color)] text-xs font-extrabold text-[var(--text-main)] shadow-sm"
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => removeWord(idx)}
                      aria-label={`Remove ${word}`}
                      className="text-[var(--text-muted)] hover:text-[var(--color-emergency)] p-0.5 cursor-pointer"
                    >
                      <XIcon size={12} />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-[var(--surface-elevated)] border border-dashed border-[var(--border-color)] text-xs text-[var(--text-secondary)]">
                Recognized gestures will assemble here.
              </div>
            )}

            {/* Next step: Build sentence */}
            <PrimaryButton
              variant="primary"
              size="md"
              fullWidth
              disabled={activeWords.length === 0}
              onClick={() => {
                stopCamera()
                setScreen("sentence")
              }}
            >
              Build &amp; Speak Sentence ({activeWords.length}) →
            </PrimaryButton>
          </div>
        </div>
      </div>

      {/* Manual Word Picker Modal */}
      <Modal
        isOpen={manualPickerOpen}
        onClose={() => setManualPickerOpen(false)}
        title="Select Vocabulary Word"
        subtitle="Choose from supported Indian Sign Language signs"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="relative">
            <SearchIcon
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search vocabulary..."
              className="input-field pl-10"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {filteredVocabulary.map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  addWord(word)
                  notify(`Added "${word}"`)
                  setManualPickerOpen(false)
                }}
                className="p-3 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-color)] hover:border-[var(--color-primary)] hover:bg-[var(--surface-soft-blue)] text-xs font-bold text-[var(--text-main)] text-center transition-all cursor-pointer"
              >
                {word}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  )
}
