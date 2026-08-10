import { describe, expect, it } from "vitest"
import { computeRequestKey, generateSuggestions } from "./engine"
import type { OverrideDTO, WindowDTO } from "./engine"

function makeAttendee(userId: string, timeZone: string, windows: WindowDTO[], overrides: OverrideDTO[] = []) {
  return { userId, timeZone, windows, overrides }
}

describe("computeRequestKey", () => {
  const base = {
    timeZone: "America/New_York",
    rangeStart: "2026-01-13",
    rangeEnd: "2026-01-20",
    durationMinutes: 60,
    stepMinutes: 15,
    dayStartMinute: 8 * 60,
    dayEndMinute: 20 * 60,
    attendeeUserIds: ["b", "a"],
  }

  it("is insensitive to attendee and target ordering", () => {
    const first = computeRequestKey({
      ...base,
      eventArchetypeId: "committee_meeting",
      targetUserIds: ["b", "a"],
    })

    const second = computeRequestKey({
      ...base,
      attendeeUserIds: ["a", "b"],
      eventArchetypeId: "committee_meeting",
      targetUserIds: ["a", "b"],
    })

    expect(first).toBe(second)
  })

  it("changes when event semantics change", () => {
    const general = computeRequestKey({
      ...base,
      eventArchetypeId: "general_meeting",
      targetUserIds: ["a", "b"],
    })

    const committee = computeRequestKey({
      ...base,
      eventArchetypeId: "committee_meeting",
      targetUserIds: ["a"],
    })

    expect(general).not.toBe(committee)
  })
})

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
