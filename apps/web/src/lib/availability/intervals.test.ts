import { describe, expect, it } from "vitest"
import { normalizeIntervals, subtractIntervals, unionIntervals } from "./intervals"

describe("availability intervals", () => {
  it("merges overlaps", () => {
    expect(normalizeIntervals([{ start: 60, end: 120 }, { start: 110, end: 180 }])).toEqual([
      { start: 60, end: 180 },
    ])
  })

  it("subtracts correctly", () => {
    expect(subtractIntervals([{ start: 60, end: 180 }], [{ start: 90, end: 120 }])).toEqual([
      { start: 60, end: 90 },
      { start: 120, end: 180 },
    ])
  })

  it("unions correctly", () => {
    expect(unionIntervals([{ start: 60, end: 90 }], [{ start: 80, end: 120 }])).toEqual([
      { start: 60, end: 120 },
    ])
  })
})
