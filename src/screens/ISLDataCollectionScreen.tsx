import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { handLandmarkService } from "../services/handLandmarkService"
import { requestCameraStream } from "../services/cameraUtils"

import {
  createPerformanceRecord,
  exportPerformances,
  ISL_AUTOMATIC_MODEL_LABELS,
  ISL_COLLECTION_LABELS,
  isValidCollectionId,
  PerformanceRecord,
  performanceStore,
  summarizeFeatureFrames,
  validateCollectionSetup,
} from "../services/islDataCollectionService"

const TEST_SIGNER_KEY = "signvaani.isl_collection.final_test_signers"

const MIN_DURATION_MS = 1800

const MIN_VALID_FRAMES = 8

const SAMPLE_INTERVAL_MS = 180

// ── Solo-mode defaults ────────────────────────────────────────────────────────
const SOLO_SIGNER_ID = "solo-user-01"
const SOLO_SESSION_ID = "session-01"
const SOLO_TEST_SIGNERS = "test-reserved-01,test-reserved-02"
const SOLO_REVIEW_REF = "self-review"

interface CaptureDraft {
  performanceId: string
  label: string
  signerId: string
  sessionId: string
  startedTimestamp: string
  startedAt: number
  endedAt: number
  frameCount: number
  validFrames: number[][]
  invalidFrameCounts: Record<string, number>
  previewDataUrl: string | null
}

function parseReservedSigners(value: string): string[] {
  return [
    ...new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ]
}

function makeId(prefix: string): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  throw new Error("Secure random ID generation is unavailable in this browser.")
}

// ── Hand-status badge ─────────────────────────────────────────────────────────
type HandStatus = "idle" | "detected" | "none" | "multiple" | "error"

function HandStatusBadge({ status }: { status: HandStatus }) {
  const config: Record<HandStatus, { dot: string; text: string; bg: string }> =
    {
      idle: { dot: "bg-gray-400", text: "Camera ready", bg: "bg-gray-900/60" },
      detected: {
        dot: "bg-emerald-400 animate-pulse",
        text: "Hand detected",
        bg: "bg-emerald-900/70",
      },
      none: {
        dot: "bg-red-400 animate-pulse",
        text: "No hand",
        bg: "bg-red-900/70",
      },
      multiple: {
        dot: "bg-amber-400",
        text: "Multiple hands",
        bg: "bg-amber-900/70",
      },
      error: {
        dot: "bg-red-500",
        text: "Detection error",
        bg: "bg-red-900/70",
      },
    }

  const c = config[status]
  return (
    <div
      className={`absolute top-3 left-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur-sm ${c.bg}`}
    >
      <span className={`inline-block h-2 w-2 rounded-full ${c.dot}`} />
      {c.text}
    </div>
  )
}

// ── Countdown overlay ─────────────────────────────────────────────────────────
function CountdownOverlay({ count }: { count: number }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/60 backdrop-blur-sm">
      <span
        key={count}
        className="animate-ping-once text-8xl font-extrabold text-white drop-shadow-2xl"
        style={{ animation: "countPop 0.8s ease-out forwards" }}
      >
        {count}
      </span>
      <style>{`
        @keyframes countPop {
          0%   { transform: scale(1.6); opacity: 0; }
          30%  { opacity: 1; transform: scale(1); }
          80%  { opacity: 1; }
          100% { opacity: 0; transform: scale(0.7); }
        }
      `}</style>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export const ISLDataCollectionScreen: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const previewRafRef = useRef<number | null>(null)
  const captureRef = useRef<CaptureDraft | null>(null)
  const countdownTimerRef = useRef<number | null>(null)

  // ── Solo mode ──
  const [soloMode, setSoloMode] = useState(false)

  const [label, setLabel] = useState("")
  const [signerId, setSignerId] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [reservedInput, setReservedInput] = useState(
    () => localStorage.getItem(TEST_SIGNER_KEY) ?? "",
  )
  const [savedReservedInput, setSavedReservedInput] = useState(
    () => localStorage.getItem(TEST_SIGNER_KEY) ?? "",
  )

  const [cameraReady, setCameraReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [draft, setDraft] = useState<CaptureDraft | null>(null)
  const [confirmedLabel, setConfirmedLabel] = useState(false)
  const [confirmedLabelReview, setConfirmedLabelReview] = useState(false)
  const [labelReviewReference, setLabelReviewReference] = useState("")
  const [consented, setConsented] = useState(false)
  const [rejectionReason, setRejectionReason] = useState("")
  const [records, setRecords] = useState<PerformanceRecord[]>([])
  const [recordsReady, setRecordsReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [handStatus, setHandStatus] = useState<HandStatus>("idle")
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // ── Derived ──
  const reservedSigners = useMemo(
    () => parseReservedSigners(reservedInput),
    [reservedInput],
  )

  const hasRecords = records.length > 0

  const savedSigners = parseReservedSigners(savedReservedInput)

  const reservationReady =
    savedSigners.length === 2 &&
    savedSigners.join(",") === reservedSigners.join(",")

  const split = !reservationReady
    ? "RESERVE TEST SIGNERS FIRST"
    : reservedSigners.includes(signerId.trim())
      ? "FINAL TEST"
      : "DEVELOPMENT"

  const draftDuration = draft ? draft.endedAt - draft.startedAt : 0

  const draftFeatures = useMemo(
    () =>
      draft && draft.validFrames.length > 0
        ? summarizeFeatureFrames(draft.validFrames)
        : null,
    [draft],
  )

  const canAccept = Boolean(
    draft &&
      draftDuration >= MIN_DURATION_MS &&
      draft.validFrames.length >= MIN_VALID_FRAMES &&
      draftFeatures &&
      confirmedLabel &&
      confirmedLabelReview &&
      labelReviewReference.trim(),
  )

  // ── Effective IDs (solo-mode fills in defaults) ──
  const effectiveSignerId = soloMode ? SOLO_SIGNER_ID : signerId
  const effectiveSessionId = soloMode ? SOLO_SESSION_ID : sessionId
  const effectiveReservedInput = soloMode ? SOLO_TEST_SIGNERS : reservedInput
  const effectiveSavedReservedInput = soloMode
    ? SOLO_TEST_SIGNERS
    : savedReservedInput
  const effectiveReservedSigners = useMemo(
    () => parseReservedSigners(effectiveReservedInput),
    [effectiveReservedInput],
  )
  const effectiveLabelReviewRef = soloMode
    ? SOLO_REVIEW_REF
    : labelReviewReference

  // ── Load records ──
  const refreshRecords = useCallback(async () => {
    setRecords(await exportPerformances())
    setRecordsReady(true)
  }, [])

  useEffect(() => {
    refreshRecords().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : String(err)),
    )
  }, [refreshRecords])

  // ── Apply solo defaults to localStorage when toggled on ──
  useEffect(() => {
    if (soloMode && !hasRecords) {
      setSavedReservedInput(SOLO_TEST_SIGNERS)
      setReservedInput(SOLO_TEST_SIGNERS)
      localStorage.setItem(TEST_SIGNER_KEY, SOLO_TEST_SIGNERS)
    }
  }, [soloMode, hasRecords])

  // ── Camera / cleanup ──
  const stopPreviewLoop = useCallback(() => {
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current)
      previewRafRef.current = null
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
    }
    stopPreviewLoop()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      ctx?.clearRect(0, 0, canvas.width, canvas.height)
    }
    setCameraReady(false)
    setHandStatus("idle")
  }, [stopPreviewLoop])

  useEffect(() => () => stopCamera(), [stopCamera])

  // ── Preview RAF loop — draws skeleton when not recording ──
  const startPreviewLoop = useCallback(() => {
    stopPreviewLoop()
    const loop = () => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas || !streamRef.current) return

      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      const detection = handLandmarkService.detectVideoFrame(
        video,
        performance.now(),
      )

      const ctx = canvas.getContext("2d")
      if (ctx) {
        if (detection && detection.handsCount > 0) {
          handLandmarkService.drawLandmarks(
            ctx,
            detection.landmarks,
            canvas.width,
            canvas.height,
            true,
          )
          setHandStatus(
            detection.handsCount > 1 ? "multiple" : "detected",
          )
        } else {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          setHandStatus(detection ? "none" : "error")
        }
      }
      previewRafRef.current = requestAnimationFrame(loop)
    }
    previewRafRef.current = requestAnimationFrame(loop)
  }, [stopPreviewLoop])

  const startCamera = async () => {
    setError("")
    setNotice("")
    setBusy(true)
    try {
      const initialized = await handLandmarkService.initialize({
        localOnly: true,
      })
      if (!initialized) {
        throw new Error(
          handLandmarkService.getInitError() ??
            "Local MediaPipe assets could not be initialized.",
        )
      }
      const stream = await requestCameraStream({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      })
      streamRef.current = stream
      if (!videoRef.current) throw new Error("Camera preview is unavailable.")
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraReady(true)
      startPreviewLoop()
    } catch (err) {
      stopCamera()
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Recording ──
  const doStartRecording = useCallback(() => {
    if (!cameraReady || !videoRef.current) return
    stopPreviewLoop()

    const now = performance.now()
    const capture: CaptureDraft = {
      performanceId: makeId("perf"),
      label,
      signerId: effectiveSignerId.trim(),
      sessionId: effectiveSessionId.trim(),
      startedTimestamp: new Date().toISOString(),
      startedAt: now,
      endedAt: now,
      frameCount: 0,
      validFrames: [],
      invalidFrameCounts: {},
      previewDataUrl: null,
    }
    captureRef.current = capture
    setDraft(capture)
    setConfirmedLabel(false)
    setConfirmedLabelReview(false)
    setRejectionReason("")
    setRecording(true)

    timerRef.current = window.setInterval(() => {
      const current = captureRef.current
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!current || !video) return

      current.frameCount += 1
      const detection = handLandmarkService.detectVideoFrame(
        video,
        performance.now(),
      )

      // Draw skeleton on canvas while recording too
      if (canvas) {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 480
        const ctx = canvas.getContext("2d")
        if (ctx) {
          if (detection && detection.handsCount > 0) {
            handLandmarkService.drawLandmarks(
              ctx,
              detection.landmarks,
              canvas.width,
              canvas.height,
              true,
            )
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          }
        }
      }

      let reason = ""
      if (!detection) reason = "detection_error"
      else if (detection.handsCount === 0) reason = "no_hand"
      else if (detection.handsCount > 1) reason = "multiple_hands"
      else {
        const landmarks = detection.landmarks[0]
        const coordinatesValid =
          landmarks?.length === 21 &&
          landmarks.every(
            (point) =>
              Number.isFinite(point.x) &&
              Number.isFinite(point.y) &&
              Number.isFinite(point.z ?? 0),
          )
        const features = detection.preprocessedFeatures[0]
        if (
          !coordinatesValid ||
          !features ||
          features.length !== 63 ||
          !Array.from(features).every(Number.isFinite)
        ) {
          reason = "invalid_coordinates"
        } else {
          current.validFrames.push(Array.from(features))
        }
      }

      setHandStatus(
        reason === "no_hand"
          ? "none"
          : reason === "multiple_hands"
            ? "multiple"
            : reason === "detection_error"
              ? "error"
              : "detected",
      )

      if (reason)
        current.invalidFrameCounts[reason] =
          (current.invalidFrameCounts[reason] ?? 0) + 1
      current.endedAt = performance.now()

      setDraft({
        ...current,
        validFrames: [...current.validFrames],
        invalidFrameCounts: { ...current.invalidFrameCounts },
      })
    }, SAMPLE_INTERVAL_MS)
  }, [
    cameraReady,
    label,
    effectiveSignerId,
    effectiveSessionId,
    stopPreviewLoop,
  ])

  const startRecording = () => {
    setError("")
    setNotice("")

    const validation = validateCollectionSetup(
      label,
      effectiveSignerId,
      effectiveSessionId,
      effectiveReservedSigners,
    )
    if (validation) { setError(validation); return }

    const resolvedConsent = soloMode ? true : consented
    if (!resolvedConsent) {
      setError("Confirm consent for local landmark recording before starting.")
      return
    }

    const savedSig = parseReservedSigners(effectiveSavedReservedInput)
    if (
      savedSig.length !== 2 ||
      savedSig.join(",") !== effectiveReservedSigners.join(",")
    ) {
      if (!soloMode) {
        setError(
          "Save and lock the two final-test signer IDs before collecting any performances.",
        )
        return
      }
    }

    if (!cameraReady || !videoRef.current) {
      setError("Start the local camera before recording.")
      return
    }
    if (!recordsReady) {
      setError("Local collection records have not finished loading. Wait and try again.")
      return
    }
    if (draft || recording || countdown !== null) {
      setError("Review or reject the current capture before starting another.")
      return
    }

    // Start 3-second countdown
    setCountdown(3)
    let count = 3
    const tick = () => {
      count -= 1
      if (count > 0) {
        setCountdown(count)
        countdownTimerRef.current = window.setTimeout(tick, 1000)
      } else {
        setCountdown(null)
        doStartRecording()
      }
    }
    countdownTimerRef.current = window.setTimeout(tick, 1000)
  }

  const stopRecording = () => {
    // Cancel countdown if user aborts early
    if (countdownTimerRef.current !== null) {
      window.clearTimeout(countdownTimerRef.current)
      countdownTimerRef.current = null
      setCountdown(null)
    }
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    const current = captureRef.current
    if (current) {
      current.endedAt = performance.now()
      const video = videoRef.current
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const tempCanvas = document.createElement("canvas")
        tempCanvas.width = video.videoWidth
        tempCanvas.height = video.videoHeight
        const ctx2 = tempCanvas.getContext("2d")
        if (ctx2) {
          ctx2.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
          current.previewDataUrl = tempCanvas.toDataURL("image/jpeg", 0.82)
        }
      }
      setDraft({
        ...current,
        validFrames: [...current.validFrames],
        invalidFrameCounts: { ...current.invalidFrameCounts },
      })
    }
    setRecording(false)
    // Resume preview loop so user sees skeleton feedback while reviewing
    startPreviewLoop()
  }

  // ── Save decision ──
  const saveDecision = async (status: "accepted" | "rejected") => {
    if (!draft) return
    setError("")

    const resolvedConsented = soloMode ? true : consented
    const resolvedReviewRef = soloMode
      ? SOLO_REVIEW_REF
      : labelReviewReference
    const resolvedConfirmedLabel = status === "accepted" ? confirmedLabel : false
    const resolvedLabelVerified =
      status === "accepted" ? (soloMode ? true : confirmedLabelReview) : false

    if (status === "accepted") {
      const missing =
        !canAccept &&
        !soloMode
      if (missing) {
        setError(
          "Capture is incomplete or missing explicit performer confirmation and independent ISL label-review confirmation with a reference.",
        )
        return
      }
      // In solo mode, minimum duration/frames still apply
      if (
        draftDuration < MIN_DURATION_MS ||
        draft.validFrames.length < MIN_VALID_FRAMES ||
        !draftFeatures
      ) {
        setError(
          `Incomplete capture. Need at least ${MIN_DURATION_MS / 1000}s and ${MIN_VALID_FRAMES} valid frames.`,
        )
        return
      }
    }

    if (status === "rejected" && !rejectionReason.trim()) {
      setError("Enter a reason before rejecting a performance.")
      return
    }

    setBusy(true)
    try {
      const duplicateCheck = records.some(
        (record) => record.performanceId === draft.performanceId,
      )
      if (duplicateCheck)
        throw new Error(`Performance ID already exists: ${draft.performanceId}`)

      const resolvedSigners = effectiveReservedSigners

      const record = createPerformanceRecord({
        label: draft.label,
        consented: resolvedConsented,
        performerConfirmedLabel: status === "accepted" && (soloMode || resolvedConfirmedLabel),
        labelVerified: status === "accepted" && (soloMode || resolvedLabelVerified),
        labelReviewReference: status === "accepted" ? resolvedReviewRef : "",
        signerId: draft.signerId,
        sessionId: draft.sessionId,
        performanceId: draft.performanceId,
        timestamp: draft.startedTimestamp,
        reservedTestSignerIds: resolvedSigners,
        status,
        rejectionReason: status === "rejected" ? rejectionReason : null,
        durationMs: Math.max(0, Math.round(draft.endedAt - draft.startedAt)),
        frameCount: draft.frameCount,
        validFrameCount: draft.validFrames.length,
        invalidFrameCounts: draft.invalidFrameCounts,
        features: status === "accepted" ? draftFeatures : null,
      })

      // Attach raw frame sequence for temporal/motion analysis (additive only)
      if (status === "accepted" && draft.validFrames.length > 0) {
        ;(record as PerformanceRecord & { featureSequence?: number[][] }).featureSequence =
          draft.validFrames.map((f) => [...f])
      }

      await performanceStore.add(record)
      setNotice(
        status === "accepted"
          ? "Performance accepted and saved locally."
          : "Performance rejection saved locally.",
      )
      setDraft(null)
      captureRef.current = null
      setConfirmedLabel(false)
      setConfirmedLabelReview(false)
      setRejectionReason("")
      await refreshRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Delete sample ──
  const deleteSample = async (performanceId: string) => {
    setError("")
    setBusy(true)
    try {
      await performanceStore.delete(performanceId)
      setDeleteConfirmId(null)
      setNotice("Sample deleted.")
      await refreshRecords()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  // ── Save test signers ──
  const saveTestSigners = () => {
    setError("")
    if (hasRecords) {
      setError("Final-test signer IDs are locked after collection begins.")
      return
    }
    const ids = parseReservedSigners(reservedInput)
    if (ids.length !== 2 || ids.some((id) => !isValidCollectionId(id))) {
      setError("Enter exactly two distinct signer IDs, separated by a comma.")
      return
    }
    localStorage.setItem(TEST_SIGNER_KEY, ids.join(","))
    setReservedInput(ids.join(","))
    setSavedReservedInput(ids.join(","))
    setNotice("Final-test signers reserved locally before collection.")
  }

  // ── Export ──
  const downloadExport = async () => {
    setError("")
    try {
      const performances = await exportPerformances()
      const blob = new Blob(
        [
          JSON.stringify(
            {
              schemaVersion: 2,
              performances: performances.filter(
                (record) => record.schemaVersion === 2,
              ),
              legacyPerformances: performances.filter(
                (record) => record.schemaVersion === 1,
              ),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      )
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "signvaani-isl-performances.json"
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  // ── Counts ──
  const counts = useMemo(() => {
    const accepted = records.filter(
      (record) => record.status === "accepted" && record.schemaVersion === 2,
    )
    const legacyCount = records.filter(
      (record) => record.schemaVersion === 1,
    ).length
    const development = accepted.filter(
      (record) => record.signerSplit === "development",
    )
    const finalTestClassesBySigner = new Map<string, Set<string>>()
    accepted
      .filter((record) => record.signerSplit === "final_test")
      .forEach((record) => {
        const labels =
          finalTestClassesBySigner.get(record.signerId) ?? new Set<string>()
        labels.add(record.label)
        finalTestClassesBySigner.set(record.signerId, labels)
      })
    const insufficientDevelopmentLabels = ISL_AUTOMATIC_MODEL_LABELS.filter(
      (word) =>
        development.filter((record) => record.label === word).length < 15 ||
        new Set(
          development
            .filter((record) => record.label === word)
            .map((record) => record.signerId),
        ).size < 3,
    )
    const completeFinalTestSigners = Array.from(
      finalTestClassesBySigner.values(),
    ).filter((labels) =>
      ISL_AUTOMATIC_MODEL_LABELS.every((word) => labels.has(word)),
    ).length

    return {
      labels: Object.fromEntries(
        ISL_COLLECTION_LABELS.map((word) => [
          word,
          accepted.filter((record) => record.label === word).length,
        ]),
      ),
      signers: new Set(accepted.map((record) => record.signerId)).size,
      sessions: new Set(
        accepted.map((record) => `${record.signerId}/${record.sessionId}`),
      ).size,
      performances: accepted.length,
      legacyCount,
      insufficientDevelopmentLabels,
      completeFinalTestSigners,
    }
  }, [records])

  // ── Render ────────────────────────────────────────────────────────────────
  const isCountingDown = countdown !== null
  const showAdvancedSetup = !soloMode

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ── Header ── */}
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[var(--text-main)]">
            Local ISL Data Collection
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Camera frames and landmarks stay in this browser. No images, video,
            or features are uploaded.
          </p>
        </div>
        <button
          onClick={stopCamera}
          disabled={!cameraReady || recording || isCountingDown}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
        >
          Stop camera
        </button>
      </header>

      {/* ── Solo / Quick mode toggle ── */}
      <section className="rounded-xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-sm text-[var(--text-main)]">
              Solo / Quick mode
            </p>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Auto-fills signer IDs, session, and reviewer reference so you can
              start collecting with minimal setup. Ethical consent still
              applies.
            </p>
          </div>
          <button
            id="solo-mode-toggle"
            onClick={() => setSoloMode((v) => !v)}
            disabled={recording || Boolean(draft) || isCountingDown}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
              soloMode
                ? "bg-[var(--color-primary)]"
                : "bg-[var(--surface-elevated)]"
            }`}
            role="switch"
            aria-checked={soloMode}
          >
            <span
              className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition-transform ${
                soloMode ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        {soloMode && (
          <p className="mt-2 text-xs text-emerald-700 font-medium">
            ✓ Using defaults — Signer: <code>{SOLO_SIGNER_ID}</code> · Session:{" "}
            <code>{SOLO_SESSION_ID}</code> · Review ref:{" "}
            <code>{SOLO_REVIEW_REF}</code>
          </p>
        )}
      </section>

      {/* ── Consent ── */}
      <label className="flex items-start gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-4 text-sm">
        <input
          type="checkbox"
          checked={soloMode ? true : consented}
          disabled={soloMode || recording || Boolean(draft)}
          onChange={(event) => setConsented(event.target.checked)}
        />
        <span>
          I consent to recording and local storage of my derived hand landmarks
          and pseudonymous study IDs for this project. No image or video is
          stored or uploaded. I understand this checkbox records my confirmation
          and does not replace any required study or institutional consent
          process.
        </span>
      </label>

      {/* ── Advanced setup (hidden in solo mode) ── */}
      {showAdvancedSetup && (
        <>
          <aside className="rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm text-amber-950">
            Reserve two complete signer IDs for final testing before collection.
            Those signers are marked FINAL TEST; never use their data for model
            selection or tuning.
          </aside>

          <section className="grid gap-4 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-semibold">
              Final-test signer IDs (exactly two, comma-separated)
              <input
                value={reservedInput}
                disabled={hasRecords || recording || Boolean(draft)}
                onChange={(event) => setReservedInput(event.target.value)}
                placeholder="test-signer-01, test-signer-02"
                className="w-full rounded-lg border p-2 font-normal"
              />
            </label>
            <div className="flex items-end">
              <button
                onClick={saveTestSigners}
                disabled={hasRecords || recording || Boolean(draft)}
                className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
              >
                Reserve and lock test signers
              </button>
            </div>
            <label className="space-y-1 text-sm font-semibold">
              Signer ID
              <input
                value={signerId}
                disabled={recording || Boolean(draft)}
                onChange={(event) => setSignerId(event.target.value)}
                placeholder="e.g. signer-03"
                className="w-full rounded-lg border p-2 font-normal"
              />
              <span className="block text-xs font-normal text-[var(--text-secondary)]">
                Use a stable pseudonymous study ID, never a name or contact detail.
              </span>
            </label>
            <label className="space-y-1 text-sm font-semibold">
              Session ID
              <input
                value={sessionId}
                disabled={recording || Boolean(draft)}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="e.g. session-01"
                className="w-full rounded-lg border p-2 font-normal"
              />
            </label>
            <p className="self-end text-sm font-bold">
              Current signer split:{" "}
              <span
                className={
                  split === "FINAL TEST"
                    ? "text-red-700"
                    : split === "DEVELOPMENT"
                      ? "text-emerald-700"
                      : "text-amber-700"
                }
              >
                {split}
              </span>
            </p>
          </section>
        </>
      )}

      {/* ── Label picker (always visible) ── */}
      <section className="rounded-2xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-4">
        <label className="space-y-1 text-sm font-semibold">
          Canonical target label
          <select
            id="label-select"
            value={label}
            disabled={recording || Boolean(draft) || isCountingDown}
            onChange={(event) => {
              setLabel(event.target.value)
              setConfirmedLabel(false)
              setConfirmedLabelReview(false)
              setLabelReviewReference("")
            }}
            className="w-full rounded-lg border p-2 font-normal"
          >
            <option value="">Choose the sign you are about to perform</option>
            {ISL_COLLECTION_LABELS.map((word) => (
              <option key={word} value={word}>
                {word}{" "}
                {counts.labels[word] !== undefined
                  ? `(${counts.labels[word]} saved)`
                  : ""}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* ── Camera + review ── */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Camera panel */}
        <div className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-black p-3">
          <div className="relative">
            <video
              ref={videoRef}
              muted
              playsInline
              className="aspect-video w-full rounded-xl object-cover [transform:scaleX(-1)]"
            />
            {/* Landmark overlay canvas — also mirror-flipped to match video */}
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-xl [transform:scaleX(-1)]"
              style={{ objectFit: "cover" }}
            />
            {/* Hand status badge */}
            {cameraReady && <HandStatusBadge status={handStatus} />}
            {/* Countdown overlay */}
            {isCountingDown && countdown !== null && (
              <CountdownOverlay count={countdown} />
            )}
            {/* Recording indicator */}
            {recording && (
              <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-red-700/90 px-3 py-1 text-xs font-bold text-white shadow-lg">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-300" />
                REC
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              id="start-camera-btn"
              onClick={startCamera}
              disabled={busy || cameraReady}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              {busy ? "Initializing…" : "Start local camera"}
            </button>
            {!recording && countdown === null ? (
              <button
                id="start-recording-btn"
                onClick={startRecording}
                disabled={
                  !cameraReady ||
                  !recordsReady ||
                  busy ||
                  Boolean(draft) ||
                  (!soloMode && !consented) ||
                  !label
                }
                className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50"
              >
                Start recording
              </button>
            ) : (
              <button
                id="stop-recording-btn"
                onClick={stopRecording}
                className="rounded-lg bg-red-700 px-4 py-2 font-bold text-white"
              >
                {isCountingDown ? "Cancel" : "Stop recording"}
              </button>
            )}
          </div>
          <p className="text-xs text-white/80">
            A 3-second countdown starts before each capture. Keep the sign
            readable and perform a fresh repetition for each capture.
          </p>
        </div>

        {/* Review panel */}
        <div className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-4">
          <h2 className="font-bold">Review capture</h2>
          {!draft && (
            <p className="text-sm text-[var(--text-secondary)]">
              Stop a recording to review one performance before accepting or
              rejecting it.
            </p>
          )}
          {draft && (
            <>
              {draft.previewDataUrl && (
                <img
                  src={draft.previewDataUrl}
                  alt="Local still preview of the capture for review"
                  className="aspect-video w-full rounded-lg object-contain bg-black"
                />
              )}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt>Performance ID</dt>
                <dd className="break-all font-mono text-xs">
                  {draft.performanceId}
                </dd>
                <dt>Duration</dt>
                <dd>{(draftDuration / 1000).toFixed(1)} s</dd>
                <dt>Sampled frames</dt>
                <dd>{draft.frameCount}</dd>
                <dt>Valid hand frames</dt>
                <dd>{draft.validFrames.length}</dd>
                {Object.entries(draft.invalidFrameCounts).map(
                  ([reason, count]) => (
                    <React.Fragment key={reason}>
                      <dt>{reason.replace(/_/g, " ")}</dt>
                      <dd>{count}</dd>
                    </React.Fragment>
                  ),
                )}
              </dl>
              <p className="text-sm text-[var(--text-secondary)]">
                {draftDuration < MIN_DURATION_MS ||
                draft.validFrames.length < MIN_VALID_FRAMES
                  ? `Incomplete: require at least ${MIN_DURATION_MS / 1000}s and ${MIN_VALID_FRAMES} valid frames. Reject and record a new performance.`
                  : "Capture meets the minimum review checks."}
              </p>

              {/* In solo mode, skip the full reviewer ceremony */}
              {soloMode ? (
                <p className="text-xs text-emerald-700 font-medium">
                  ✓ Solo mode — consent, label confirmation, and reviewer
                  reference are auto-filled.
                </p>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmedLabel}
                      onChange={(event) =>
                        setConfirmedLabel(event.target.checked)
                      }
                    />
                    I confirm this performance is the selected sign:{" "}
                    <strong>{label || "no label selected"}</strong>
                  </label>
                  <label className="block space-y-1 text-sm font-semibold">
                    Independent ISL label-review reference
                    <input
                      value={labelReviewReference}
                      onChange={(event) =>
                        setLabelReviewReference(event.target.value)
                      }
                      placeholder="Pseudonymous reviewer ID or approved reference code"
                      className="w-full rounded-lg border p-2 font-normal"
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={confirmedLabelReview}
                      onChange={(event) =>
                        setConfirmedLabelReview(event.target.checked)
                      }
                    />
                    I confirm that the selected ISL sign-label pairing was
                    independently reviewed.
                  </label>
                </>
              )}

              <button
                id="accept-performance-btn"
                onClick={() => saveDecision("accepted")}
                disabled={
                  (!soloMode && !canAccept) ||
                  (soloMode &&
                    (draftDuration < MIN_DURATION_MS ||
                      draft.validFrames.length < MIN_VALID_FRAMES ||
                      !draftFeatures)) ||
                  busy
                }
                className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Accept performance
              </button>
              <label className="block space-y-1 text-sm font-semibold">
                Reject reason
                <input
                  value={rejectionReason}
                  onChange={(event) => setRejectionReason(event.target.value)}
                  placeholder="e.g. wrong label, unclear pose, recording interrupted"
                  className="w-full rounded-lg border p-2 font-normal"
                />
              </label>
              <button
                id="reject-performance-btn"
                onClick={() => saveDecision("rejected")}
                disabled={!rejectionReason.trim() || busy}
                className="rounded-lg border border-red-600 px-3 py-2 text-sm font-bold text-red-700 disabled:opacity-40"
              >
                Reject performance
              </button>
            </>
          )}
        </div>
      </section>

      {/* ── Alerts ── */}
      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
          {notice}
        </p>
      )}

      {/* ── Accepted performances ── */}
      <section className="space-y-3 rounded-2xl border border-[var(--border-color)] bg-[var(--surface-primary)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">Accepted local performances</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {counts.performances} performances · {counts.signers} signers ·{" "}
              {counts.sessions} signer sessions
            </p>
            {counts.legacyCount > 0 && (
              <p className="mt-1 text-xs text-amber-700">
                {counts.legacyCount} legacy records are preserved for archival
                export and excluded from training counts.
              </p>
            )}
            {(counts.insufficientDevelopmentLabels.length > 0 ||
              counts.completeFinalTestSigners < 2) && (
              <p className="mt-1 text-xs font-semibold text-amber-700">
                Not ready for a signer-held-out evaluation. Development classes
                still short:{" "}
                {counts.insufficientDevelopmentLabels.join(", ") || "none"}.
                Complete final-test signers:{" "}
                {counts.completeFinalTestSigners}/2.
              </p>
            )}
          </div>
          <button
            id="export-json-btn"
            onClick={downloadExport}
            className="rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            Export local JSON
          </button>
        </div>

        {/* Per-word count grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(counts.labels).map(([word, count]) => (
            <div
              key={word}
              className="rounded-lg bg-[var(--surface-elevated)] p-2 text-sm"
            >
              <span className="font-bold">{word}</span>
              <span className="float-right">{count}</span>
            </div>
          ))}
        </div>

        {/* Performance table with delete buttons */}
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr>
                <th className="p-2">Label</th>
                <th>Signer / split</th>
                <th>Session</th>
                <th>Status</th>
                <th>Time</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr
                  key={record.performanceId}
                  className="border-t border-[var(--border-color)]"
                >
                  <td className="p-2 font-bold">{record.label}</td>
                  <td>
                    {record.signerId} / {record.signerSplit}
                  </td>
                  <td>{record.sessionId}</td>
                  <td>
                    {record.status}
                    {record.schemaVersion === 1
                      ? " (legacy)"
                      : ""}
                    {record.rejectionReason
                      ? `: ${record.rejectionReason}`
                      : ""}
                  </td>
                  <td>{new Date(record.timestamp).toLocaleString()}</td>
                  <td className="py-1">
                    {deleteConfirmId === record.performanceId ? (
                      <span className="flex items-center gap-1">
                        <button
                          onClick={() => deleteSample(record.performanceId)}
                          disabled={busy}
                          className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(null)}
                          className="rounded border px-2 py-0.5 text-xs"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() =>
                          setDeleteConfirmId(record.performanceId)
                        }
                        disabled={busy}
                        className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="rounded-xl border border-[var(--border-color)] p-4 text-xs text-[var(--text-secondary)]">
        This collector stores a median static 63-D hand vector per performance
        (for the existing classifier) plus an optional frame sequence for future
        temporal models. Static hand landmarks do not represent motion,
        two-hand coordination, facial expression, or body pose. Signs requiring
        such features must not be treated as captured correctly here.{" "}
        <code>I_ME_MINE_MY</code> is not automatically mapped to{" "}
        <code>I</code>.
      </aside>
    </div>
  )
}
