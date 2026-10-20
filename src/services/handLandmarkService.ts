/**
 * Genuine Computer Vision & Hand Landmark Extraction Service
 * Powered by MediaPipe Tasks Vision HandLandmarker
 *
 * Extracts 21 3D landmarks per detected hand from live camera video frames,
 * computes normalized geometric feature representations, and renders
 * real-time tracking skeleton overlay on canvas.
 */

import {
  FilesetResolver,
  HandLandmarker,
  NormalizedLandmark,
} from "@mediapipe/tasks-vision"

// Standard 21-landmark MediaPipe Hand connectivity graph
export const HAND_CONNECTIONS: [number, number][] = [
  // Thumb
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index finger
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Middle finger
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Ring finger
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Pinky
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm transverse connections
  [5, 9],
  [9, 13],
  [13, 17],
]

export interface HandDetectionResult {
  handsCount: number
  landmarks: NormalizedLandmark[][]
  handedness: string[]
  preprocessedFeatures: Float32Array[]
}

class HandLandmarkService {
  private handLandmarker: HandLandmarker | null = null
  private isInitializing = false
  private initError: string | null = null
  private lastProcessedTimestamp = -1

  public isReady(): boolean {
    return this.handLandmarker !== null
  }

  public getInitError(): string | null {
    return this.initError
  }

  public async initialize(
    options: { localOnly?: boolean } = {},
  ): Promise<boolean> {
    if (this.handLandmarker) return true
    if (this.isInitializing) {
      // Wait for ongoing initialization
      while (this.isInitializing) {
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      return this.handLandmarker !== null
    }

    this.isInitializing = true
    this.initError = null

    try {
      // 1. Resolve WASM assets (try local first, fallback to CDN if needed)
      let vision
      try {
        vision = await FilesetResolver.forVisionTasks("/wasm")
      } catch (localWasmErr) {
        if (options.localOnly) throw localWasmErr
        console.warn(
          "Local WASM resolver failed, attempting CDN fallback:",
          localWasmErr,
        )
        vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm",
        )
      }

      // 2. Initialize HandLandmarker with GPU -> CPU delegate fallback
      const createLandmarker = async (modelPath: string): Promise<HandLandmarker> => {
        try {
          return await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })
        } catch (gpuErr) {
          console.warn("GPU delegate unavailable, attempting CPU delegate:", gpuErr)
          return await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: modelPath,
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numHands: 2,
            minHandDetectionConfidence: 0.5,
            minHandPresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          })
        }
      }

      let landmarker: HandLandmarker
      try {
        landmarker = await createLandmarker("/models/hand_landmarker.task")
      } catch (localModelErr) {
        if (options.localOnly) throw localModelErr
        console.warn(
          "Local model asset failed, trying remote asset path:",
          localModelErr,
        )
        landmarker = await createLandmarker(
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        )
      }

      this.handLandmarker = landmarker
      this.isInitializing = false
      return true
    } catch (err: any) {
      this.initError =
        err?.message || "Failed to initialize MediaPipe Hand Landmarker"
      console.error("HandLandmarkService initialization error:", err)
      this.isInitializing = false
      return false
    }
  }

  /**
   * Preprocessing Pipeline:
   * 1. Translates landmarks so wrist (landmark 0) is at origin (0, 0, 0).
   * 2. Scales landmarks by middle metacarpal distance (landmark 0 to 9) to ensure scale invariance.
   * 3. Flattens into a 63-dimensional feature vector: [x0, y0, z0, ..., x20, y20, z20].
   */
  public preprocessLandmarks(landmarks: NormalizedLandmark[]): Float32Array {
    const features = new Float32Array(63)
    if (!landmarks || landmarks.length !== 21) {
      return features
    }

    const wrist = landmarks[0]
    const middleMcp = landmarks[9]

    // Calculate scale factor (palm reference length)
    const dx = middleMcp.x - wrist.x
    const dy = middleMcp.y - wrist.y
    const dz = (middleMcp.z || 0) - (wrist.z || 0)
    const palmLength = Math.sqrt(dx * dx + dy * dy + dz * dz)
    const scale = palmLength > 0.001 ? 1.0 / palmLength : 1.0

    // Center on wrist and scale
    for (let i = 0; i < 21; i++) {
      const lm = landmarks[i]
      features[i * 3] = (lm.x - wrist.x) * scale
      features[i * 3 + 1] = (lm.y - wrist.y) * scale
      features[i * 3 + 2] = ((lm.z || 0) - (wrist.z || 0)) * scale
    }

    return features
  }

  /**
   * Detect hands from live video frame.
   */
  public detectVideoFrame(
    video: HTMLVideoElement,
    timestamp: number,
  ): HandDetectionResult | null {
    if (!this.handLandmarker) return null
    if (video.readyState < 2 || video.paused || video.ended) return null

    // Ensure monotonically increasing timestamp for MediaPipe VIDEO mode
    const frameTimestamp =
      timestamp > this.lastProcessedTimestamp
        ? timestamp
        : this.lastProcessedTimestamp + 1
    this.lastProcessedTimestamp = frameTimestamp

    try {
      const results = this.handLandmarker.detectForVideo(video, frameTimestamp)
      const landmarksList = results.landmarks || []
      const handednessList: string[] = []

      if (results.handednesses) {
        for (const h of results.handednesses) {
          if (h && h[0]) {
            handednessList.push(h[0].categoryName || "Hand")
          }
        }
      }

      const preprocessed = landmarksList.map((lm) =>
        this.preprocessLandmarks(lm),
      )

      return {
        handsCount: landmarksList.length,
        landmarks: landmarksList,
        handedness: handednessList,
        preprocessedFeatures: preprocessed,
      }
    } catch (err) {
      console.warn("Hand landmarker frame detection warning:", err)
      return null
    }
  }

  /**
   * Draw genuine hand landmark skeleton over video canvas.
   * Mirror-aware drawing matching user camera reflection.
   */
  public drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarksList: NormalizedLandmark[][],
    width: number,
    height: number,
    isMirrored = true,
  ) {
    ctx.clearRect(0, 0, width, height)
    if (!landmarksList || landmarksList.length === 0) return

    landmarksList.forEach((landmarks) => {
      // Map normalized coordinates to canvas pixels
      const points = landmarks.map((lm) => ({
        x: isMirrored ? (1 - lm.x) * width : lm.x * width,
        y: lm.y * height,
      }))

      // 1. Draw connection bones
      ctx.lineWidth = 3.5
      ctx.strokeStyle = "rgba(40, 122, 116, 0.85)" // Sea Glass deep teal
      ctx.lineCap = "round"
      ctx.lineJoin = "round"

      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = points[startIdx]
        const end = points[endIdx]
        if (!start || !end) return

        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(end.x, end.y)
        ctx.stroke()
      })

      // 2. Draw landmark joints
      points.forEach((pt, idx) => {
        const isTip = [4, 8, 12, 16, 20].includes(idx)
        const radius = isTip ? 5.5 : 3.5

        ctx.beginPath()
        ctx.arc(pt.x, pt.y, radius, 0, 2 * Math.PI)
        ctx.fillStyle = isTip ? "#3A8F76" : "#E8F4F0" // Fingertips in success green, joints seafoam
        ctx.fill()

        ctx.lineWidth = 2
        ctx.strokeStyle = "#173E46"
        ctx.stroke()
      })
    })
  }

  public close() {
    if (this.handLandmarker) {
      try {
        this.handLandmarker.close()
      } catch (err) {
        console.warn("Error closing HandLandmarker:", err)
      }
      this.handLandmarker = null
    }
    this.lastProcessedTimestamp = -1
  }
}

export const handLandmarkService = new HandLandmarkService()
