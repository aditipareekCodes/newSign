import { describe, expect, it } from "vitest"
import { appendSentenceWord } from "./AppContext"

describe("manual sentence building", () => {
  it("appends a manually selected word without changing prior words", () => {
    const existing = ["I", "NEED"]

    expect(appendSentenceWord(existing, "WATER")).toEqual([
      "I",
      "NEED",
      "WATER",
    ])
    expect(existing).toEqual(["I", "NEED"])
  })
})
