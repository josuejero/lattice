import { describe, expect, it } from "vitest"
import { generateSuggestions } from "./engine"
import type { OverrideDTO, WindowDTO } from "./engine"

function makeAttendee(userId: string, timeZone: string, windows: WindowDTO[], overrides: OverrideDTO[] = []) {
  return { userId, timeZone, windows, overrides }
}

describe("generateSuggestions", () => {
  it("is deterministic with tie-breakers", () => {
    const attendees = [
      makeAttendee("a", "America/New_York", [{ dayOfWeek: 2, startMinute: 9 * 60, endMinute: 17 * 60 }]),
      makeAttendee("b", "America/New_York", [{ dayOfWeek: 2, startMinute: 9 * 60, endMinute: 17 * 60 }]),
    ]

    const res1 = generateSuggestions({
      timeZone: "America/New_York",
      rangeStart: "2026-01-13",
      rangeEnd: "2026-01-13",
      durationMinutes: 30,
      stepMinutes: 30,
      dayStartMinute: 9 * 60,
      dayEndMinute: 11 * 60,
      attendees,
      maxCandidates: 10,
    })

    const res2 = generateSuggestions({
      timeZone: "America/New_York",
      rangeStart: "2026-01-13",
      rangeEnd: "2026-01-13",
      durationMinutes: 30,
      stepMinutes: 30,
      dayStartMinute: 9 * 60,
      dayEndMinute: 11 * 60,
      attendees,
      maxCandidates: 10,
    })

    expect(res1).toEqual(res2)
    expect(res1[0]?.rank).toBe(1)
  })

  it("respects attendee time zones", () => {
    const ny = makeAttendee("ny", "America/New_York", [{ dayOfWeek: 2, startMinute: 9 * 60, endMinute: 10 * 60 }])
    const la = makeAttendee("la", "America/Los_Angeles", [{ dayOfWeek: 2, startMinute: 9 * 60, endMinute: 10 * 60 }])

    const res = generateSuggestions({
      timeZone: "America/New_York",
      rangeStart: "2026-01-13",
      rangeEnd: "2026-01-13",
      durationMinutes: 30,
      stepMinutes: 30,
      dayStartMinute: 9 * 60,
      dayEndMinute: 10 * 60,
      attendees: [ny, la],
      maxCandidates: 10,
    })

    expect(res.length).toBeGreaterThan(0)
    expect(res[0].missingUserIds).toContain("la")
  })

  it("applies UNAVAILABLE overrides", () => {
    const attendee = makeAttendee(
      "u",
      "America/New_York",
      [{ dayOfWeek: 2, startMinute: 9 * 60, endMinute: 12 * 60 }],
      [
        {
          startAt: "2026-01-13T15:00:00.000Z",
          endAt: "2026-01-13T16:00:00.000Z",
          kind: "UNAVAILABLE",
        },
      ],
    )

    const res = generateSuggestions({
      timeZone: "America/New_York",
      rangeStart: "2026-01-13",
      rangeEnd: "2026-01-13",
      durationMinutes: 30,
      stepMinutes: 30,
      dayStartMinute: 9 * 60,
      dayEndMinute: 12 * 60,
      attendees: [attendee],
      maxCandidates: 20,
    })

    expect(res.some((candidate) => candidate.startAt === "2026-01-13T15:00:00.000Z")).toBe(false)
  })
})
