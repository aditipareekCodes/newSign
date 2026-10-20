export const ISL_COLLECTION_LABELS = [
  "I",

  "NEED",

  "WATER",

  "HELP",

  "FAMILY",
  "THANK",
  "HELLO",
  "YOU",

  "HOME",

  "MEDICAL",

  "PLEASE",

  "FOOD",

  "PAIN",
] as const

export const ISL_AUTOMATIC_MODEL_LABELS = [
  "FOOD",
  "HELLO",
  "HELP",
  "I",
  "PLEASE",
  "THANK",
  "WATER",
  "YOU",
] as const

export type ISLCollectionLabel = typeof ISL_COLLECTION_LABELS[number]

export type SignerSplit = "final_test" | "development"

export type PerformanceStatus = "accepted" | "rejected"

export const MIN_ACCEPTED_DURATION_MS = 1800

export const MIN_ACCEPTED_FRAMES = 8

export interface PerformanceRecord {
  schemaVersion: 1 | 2

  preprocessingSchema?: "mediapipe_hand_21_xyz_wrist_scale_v1"

  consented?: boolean

  performerConfirmedLabel?: boolean

  labelVerified?: boolean

  labelReviewReference?: string

  label: ISLCollectionLabel

  signerId: string

  sessionId: string

  performanceId: string

  timestamp: string

  source: "local_webcam"

  signerSplit: SignerSplit

  status: PerformanceStatus

  rejectionReason: string | null

  decisionReason: string

  durationMs: number

  frameCount: number

  validFrameCount: number

  invalidFrameCounts: Record<string, number>

  features: number[] | null

  /**
   * Optional: full sequence of per-frame 63-D feature vectors captured during
   * the performance. Preserved for temporal / motion analysis. The static
   * `features` median above is always the primary field used by the existing
   * classifier; this field is purely additive and never replaces it.
   */
  featureSequence?: number[][]
}

export function isCollectionLabel(value: string): value is ISLCollectionLabel {
  return (ISL_COLLECTION_LABELS as readonly string[]).includes(value)
}

export function isValidCollectionId(value: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value.trim())
}

export function validateCollectionSetup(
  label: string,

  signerId: string,

  sessionId: string,

  reservedTestSignerIds: string[],
): string | null {
  if (!isCollectionLabel(label))
    return "Select a canonical SignVaani target label."

  if (!isValidCollectionId(signerId))
    return "Signer ID must use 1–64 letters, numbers, dots, underscores, or hyphens."

  if (!isValidCollectionId(sessionId))
    return "Session ID must use 1–64 letters, numbers, dots, underscores, or hyphens."

  const reserved = [
    ...new Set(reservedTestSignerIds.map((id) => id.trim()).filter(Boolean)),
  ]

  if (
    reserved.length !== 2 ||
    reserved.some((id) => !isValidCollectionId(id))
  ) {
    return "Reserve exactly two valid signer IDs for final testing before collecting data."
  }

  return null
}

export function summarizeFeatureFrames(frames: number[][]): number[] {
  if (
    frames.length === 0 ||
    frames.some(
      (frame) => frame.length !== 63 || frame.some((v) => !Number.isFinite(v)),
    )
  ) {
    throw new Error(
      "A performance requires finite 63-dimensional feature frames.",
    )
  }

  return Array.from({ length: 63 }, (_, featureIndex) => {
    const values = frames
      .map((frame) => frame[featureIndex])
      .sort((a, b) => a - b)

    const middle = Math.floor(values.length / 2)

    return values.length % 2
      ? values[middle]
      : (values[middle - 1] + values[middle]) / 2
  })
}

export function createPerformanceRecord(input: {
  label: string

  consented: boolean

  performerConfirmedLabel: boolean

  labelVerified: boolean

  labelReviewReference: string

  signerId: string

  sessionId: string

  performanceId: string

  timestamp: string

  reservedTestSignerIds: string[]

  status: PerformanceStatus

  rejectionReason?: string | null

  durationMs: number

  frameCount: number

  validFrameCount: number

  invalidFrameCounts: Record<string, number>

  features: number[] | null
}): PerformanceRecord {
  const setupError = validateCollectionSetup(
    input.label,
    input.signerId,
    input.sessionId,
    input.reservedTestSignerIds,
  )

  if (setupError) throw new Error(setupError)

  if (!isCollectionLabel(input.label))
    throw new Error("Invalid canonical label.")

  if (!input.consented)
    throw new Error("Recording consent is required before saving a performance.")

  if (input.status === "accepted" && !input.labelVerified)
    throw new Error("Accepted performances require independent ISL label review.")

  if (input.status === "accepted" && !input.performerConfirmedLabel)
    throw new Error("Accepted performances require explicit performer-label confirmation.")

  if (
    input.status === "accepted" &&
    !isValidCollectionId(input.labelReviewReference)
  )
    throw new Error(
      "Accepted performances require a valid pseudonymous label-review reference.",
    )

  if (!isValidCollectionId(input.performanceId))
    throw new Error("Invalid performance ID.")

  if (!Number.isFinite(Date.parse(input.timestamp)))
    throw new Error("Invalid performance timestamp.")

  if (
    input.durationMs < 0 ||
    input.frameCount < 0 ||
    input.validFrameCount < 0 ||
    input.validFrameCount > input.frameCount
  ) {
    throw new Error("Invalid performance frame or duration metadata.")
  }

  if (input.status === "accepted") {
    if (
      input.rejectionReason ||
      input.durationMs < MIN_ACCEPTED_DURATION_MS ||
      input.validFrameCount < MIN_ACCEPTED_FRAMES ||
      !input.features ||
      input.features.length !== 63 ||
      input.features.some((v) => !Number.isFinite(v))
    ) {
      throw new Error(
        "Accepted performances require valid features and no rejection reason.",
      )
    }
  } else if (!input.rejectionReason?.trim()) {
    throw new Error(
      "Rejected performances require an explicit rejection reason.",
    )
  }

  const reserved = input.reservedTestSignerIds.map((id) => id.trim())

  return {
    schemaVersion: 2,

    preprocessingSchema: "mediapipe_hand_21_xyz_wrist_scale_v1",

    consented: input.consented,

    performerConfirmedLabel: input.performerConfirmedLabel,

    labelVerified: input.labelVerified,

    labelReviewReference: input.labelReviewReference.trim(),

    label: input.label,

    signerId: input.signerId.trim(),

    sessionId: input.sessionId.trim(),

    performanceId: input.performanceId.trim(),

    timestamp: input.timestamp,

    source: "local_webcam",

    signerSplit: reserved.includes(input.signerId.trim())
      ? "final_test"
      : "development",

    status: input.status,

    rejectionReason:
      input.status === "rejected" ? input.rejectionReason!.trim() : null,

    decisionReason:
      input.status === "accepted"
        ? "explicit_label_confirmed_and_capture_complete"
        : input.rejectionReason!.trim(),

    durationMs: input.durationMs,

    frameCount: input.frameCount,

    validFrameCount: input.validFrameCount,

    invalidFrameCounts: { ...input.invalidFrameCounts },

    features: input.features ? [...input.features] : null,
  }
}

export function validatePerformanceRecord(
  value: unknown,
): value is PerformanceRecord {
  if (!value || typeof value !== "object") return false

  const record = value as Partial<PerformanceRecord>

  if (record.schemaVersion === 1) {
    if (
      typeof record.label !== "string" ||
      !isCollectionLabel(record.label) ||
      typeof record.signerId !== "string" ||
      !isValidCollectionId(record.signerId) ||
      typeof record.sessionId !== "string" ||
      !isValidCollectionId(record.sessionId) ||
      typeof record.performanceId !== "string" ||
      !isValidCollectionId(record.performanceId) ||
      typeof record.timestamp !== "string" ||
      !Number.isFinite(Date.parse(record.timestamp)) ||
      record.source !== "local_webcam" ||
      !["final_test", "development"].includes(String(record.signerSplit)) ||
      !["accepted", "rejected"].includes(String(record.status))
    ) {
      return false
    }

    if (record.status === "accepted") {
      return (
        Array.isArray(record.features) &&
        record.features.length === 63 &&
        record.features.every(Number.isFinite)
      )
    }

    return (
      typeof record.rejectionReason === "string" &&
      record.rejectionReason.trim().length > 0 &&
      record.features === null
    )
  }

  if (
    record.schemaVersion !== 2 ||
    record.preprocessingSchema !== "mediapipe_hand_21_xyz_wrist_scale_v1" ||
    typeof record.consented !== "boolean" ||
    typeof record.performerConfirmedLabel !== "boolean" ||
    typeof record.labelVerified !== "boolean" ||
    typeof record.labelReviewReference !== "string" ||
    typeof record.label !== "string" ||
    !isCollectionLabel(record.label) ||
    typeof record.signerId !== "string" ||
    !isValidCollectionId(record.signerId) ||
    typeof record.sessionId !== "string" ||
    !isValidCollectionId(record.sessionId) ||
    typeof record.performanceId !== "string" ||
    !isValidCollectionId(record.performanceId) ||
    typeof record.timestamp !== "string" ||
    !Number.isFinite(Date.parse(record.timestamp)) ||
    record.source !== "local_webcam" ||
    !["final_test", "development"].includes(String(record.signerSplit)) ||
    !["accepted", "rejected"].includes(String(record.status)) ||
    typeof record.decisionReason !== "string" ||
    record.decisionReason.trim().length === 0 ||
    !Number.isFinite(record.durationMs) ||
    record.durationMs! < 0 ||
    !Number.isInteger(record.frameCount) ||
    record.frameCount! < 0 ||
    !Number.isInteger(record.validFrameCount) ||
    record.validFrameCount! < 0 ||
    record.validFrameCount! > record.frameCount! ||
    !record.invalidFrameCounts ||
    typeof record.invalidFrameCounts !== "object" ||
    Array.isArray(record.invalidFrameCounts) ||
    Object.values(record.invalidFrameCounts).some(
      (count) => !Number.isInteger(count) || count < 0,
    )
  )
    return false

  if (record.status === "accepted") {
    return (
      !record.rejectionReason &&
      record.consented &&
      record.performerConfirmedLabel &&
      record.labelVerified &&
      isValidCollectionId(record.labelReviewReference) &&
      Array.isArray(record.features) &&
      record.features.length === 63 &&
      record.features.every(Number.isFinite) &&
      record.durationMs! >= MIN_ACCEPTED_DURATION_MS &&
      record.validFrameCount! >= MIN_ACCEPTED_FRAMES &&
      record.validFrameCount! <= record.frameCount!
    )
  }

  return (
    typeof record.rejectionReason === "string" &&
    record.rejectionReason.trim().length > 0 &&
    record.features === null
  )
}

export interface PerformanceStore {
  list(): Promise<PerformanceRecord[]>

  add(record: PerformanceRecord): Promise<void>

  delete(performanceId: string): Promise<void>
}

const DATABASE_NAME = "signvaani-isl-collection"

const DATABASE_VERSION = 2

const STORE_NAME = "performances"

function openCollectionDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error(
        "This browser does not support local IndexedDB collection storage.",
      ),
    )
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "performanceId" })
      }
    }

    request.onsuccess = () => resolve(request.result)

    request.onerror = () =>
      reject(
        request.error ?? new Error("Could not open local collection storage."),
      )

    request.onblocked = () =>
      reject(
        new Error("Collection storage upgrade is blocked by another open tab."),
      )
  })
}

export const performanceStore: PerformanceStore = {
  async list() {
    const database = await openCollectionDatabase()

    try {
      return await new Promise<PerformanceRecord[]>((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, "readonly")
          .objectStore(STORE_NAME)
          .getAll()

        request.onsuccess = () => resolve(request.result as PerformanceRecord[])

        request.onerror = () =>
          reject(
            request.error ?? new Error("Could not read local performances."),
          )
      })
    } finally {
      database.close()
    }
  },

  async add(record) {
    if (!validatePerformanceRecord(record))
      throw new Error("Refusing to save invalid performance metadata.")

    const database = await openCollectionDatabase()

    try {
      await new Promise<void>((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, "readwrite")
          .objectStore(STORE_NAME)
          .add(record)

        request.onsuccess = () => resolve()

        request.onerror = () => {
          if (request.error?.name === "ConstraintError") {
            reject(
              new Error(
                `Performance ID already exists: ${record.performanceId}`,
              ),
            )
          } else {
            reject(
              request.error ?? new Error("Could not save local performance."),
            )
          }
        }
      })
    } finally {
      database.close()
    }
  },

  async delete(performanceId: string) {
    if (!performanceId || !performanceId.trim())
      throw new Error("A valid performanceId is required to delete a record.")

    const database = await openCollectionDatabase()

    try {
      await new Promise<void>((resolve, reject) => {
        const request = database
          .transaction(STORE_NAME, "readwrite")
          .objectStore(STORE_NAME)
          .delete(performanceId.trim())

        request.onsuccess = () => resolve()

        request.onerror = () =>
          reject(
            request.error ?? new Error("Could not delete local performance."),
          )
      })
    } finally {
      database.close()
    }
  },
}

export async function exportPerformances(
  store: PerformanceStore = performanceStore,
): Promise<PerformanceRecord[]> {
  const records = await store.list()

  const ids = new Set<string>()

  for (const record of records) {
    if (!validatePerformanceRecord(record))
      throw new Error("Local collection contains invalid performance metadata.")

    if (ids.has(record.performanceId))
      throw new Error(
        `Duplicate performance ID in collection: ${record.performanceId}`,
      )

    ids.add(record.performanceId)
  }

  return records.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
