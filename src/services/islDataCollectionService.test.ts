import { describe, expect, it } from "vitest"

import { handLandmarkService } from "./handLandmarkService"

import {
  createPerformanceRecord,
  exportPerformances,
  isCollectionLabel,
  PerformanceRecord,
  PerformanceStore,
  summarizeFeatureFrames,
  validateCollectionSetup,
  validatePerformanceRecord,
} from "./islDataCollectionService"

const reservedTestSignerIds = ["test-01", "test-02"]

function makeRecord(
  overrides: Partial<Parameters<typeof createPerformanceRecord>[0]> = {},
) {
  return createPerformanceRecord({
    label: "YOU",

    signerId: "signer-03",

    sessionId: "session-01",

    performanceId: "perf-001",

    timestamp: "2026-10-11T00:00:00.000Z",

    reservedTestSignerIds,

    status: "accepted",

    consented: true,

    performerConfirmedLabel: true,

    labelVerified: true,

    labelReviewReference: "review-source-01",

    durationMs: 2200,

    frameCount: 12,

    validFrameCount: 10,

    invalidFrameCounts: { no_hand: 2 },

    features: Array.from({ length: 63 }, (_, index) => index / 10),

    ...overrides,
  })
}

describe("ISL data collection integrity", () => {
  it("only accepts the explicit canonical target labels", () => {
    expect(isCollectionLabel("I")).toBe(true)
    expect(isCollectionLabel("HELLO")).toBe(true)

    expect(isCollectionLabel("I_ME_MINE_MY")).toBe(false)

    expect(
      validateCollectionSetup(
        "I_ME_MINE_MY",
        "signer-1",
        "session-1",
        reservedTestSignerIds,
      ),
    )

      .toContain("canonical")
  })

  it("requires exactly two valid reserved test signers", () => {
    expect(
      validateCollectionSetup("YOU", "test-01", "session-1", [
        "test-01",
        "test-02",
      ]),
    ).toBeNull()

    expect(
      validateCollectionSetup("YOU", "signer-1", "session-1", ["test-01"]),
    ).toContain("exactly two")

    expect(
      validateCollectionSetup(
        "YOU",
        "bad id",
        "session-1",
        reservedTestSignerIds,
      ),
    ).toContain("Signer ID")

    expect(() => makeRecord({ performanceId: "../outside" })).toThrow(
      "Invalid performance ID",
    )
  })

  it("creates complete metadata and keeps reserved test signer designation", () => {
    const record = makeRecord({ signerId: "test-01" })

    expect(record).toMatchObject({
      schemaVersion: 2,

      preprocessingSchema: "mediapipe_hand_21_xyz_wrist_scale_v1",

      label: "YOU",

      signerId: "test-01",

      sessionId: "session-01",

      performanceId: "perf-001",

      source: "local_webcam",

      signerSplit: "final_test",

      status: "accepted",
    })

    expect(validatePerformanceRecord(record)).toBe(true)

    expect(record.features).toHaveLength(63)
  })

  it("requires a reason for every rejected capture and forbids features", () => {
    expect(() =>
      makeRecord({ status: "rejected", rejectionReason: "", features: null }),
    )

      .toThrow("explicit rejection reason")

    const rejected = makeRecord({
      status: "rejected",
      rejectionReason: "unclear sign",
      features: null,
    })

    expect(validatePerformanceRecord(rejected)).toBe(true)
  })

  it("requires user-confirmed consent and label verification for training samples", () => {
    expect(() => makeRecord({ consented: false })).toThrow("consent")
    expect(() => makeRecord({ labelVerified: false })).toThrow("independent ISL")
    expect(() => makeRecord({ performerConfirmedLabel: false })).toThrow(
      "performer-label confirmation",
    )
    expect(() => makeRecord({ labelReviewReference: "" })).toThrow(
      "pseudonymous label-review reference",
    )
  })

  it("preserves legacy records for archival export without treating them as v2 training data", async () => {
    const legacy = {
      ...makeRecord(),
      schemaVersion: 1 as const,
    }
    delete (legacy as Partial<typeof legacy>).preprocessingSchema
    delete (legacy as Partial<typeof legacy>).consented
    delete (legacy as Partial<typeof legacy>).labelVerified
    const store: PerformanceStore = {
      list: async () => [legacy],
      add: async () => undefined,
    }

    expect(validatePerformanceRecord(legacy)).toBe(true)
    expect((await exportPerformances(store))[0].schemaVersion).toBe(1)
  })

  it("rejects malformed or non-finite features and duplicate IDs on export", async () => {
    const malformed = { ...makeRecord(), features: [Number.NaN] }

    expect(validatePerformanceRecord(malformed)).toBe(false)

    const repeated = makeRecord()

    const store: PerformanceStore = {
      list: async () => [repeated, { ...repeated }],

      add: async () => undefined,
    }

    await expect(exportPerformances(store)).rejects.toThrow(
      "Duplicate performance ID",
    )
  })

  it("summarizes a performance as one deterministic 63-value feature vector", () => {
    const first = Array.from({ length: 63 }, (_, index) => index)

    const second = first.map((value) => value + 2)

    expect(summarizeFeatureFrames([first, second])).toEqual(
      first.map((value) => value + 1),
    )

    expect(() => summarizeFeatureFrames([[1, 2]])).toThrow("63-dimensional")
  })

  it("matches production landmark ordering and normalization", () => {
    const landmarks = Array.from({ length: 21 }, (_, index) => ({
      x: 0.2 + index * 0.013,

      y: 0.4 - index * 0.007,

      z: -index * 0.002,

      visibility: 1,
    }))

    const production = handLandmarkService.preprocessLandmarks(landmarks)

    const collection = summarizeFeatureFrames([Array.from(production)])

    expect(collection).toEqual(Array.from(production))
  })
})
