import { describe, expect, it } from "vitest"

import {
  MAX_EVENT_DURATION_MINUTES,
  normalizeSuggestionRequestTargets,
  SuggestionRequestInputSchema,
} from "./request-contract"

function baseInput() {
  return {
    timeZone: "America/New_York",
    rangeStart: "2026-08-10",
    rangeEnd: "2026-08-17",
    durationMinutes: 150,
    stepMinutes: 15,
    dayStart: "09:00",
    dayEnd: "21:00",
    attendeeUserIds: ["b", "a"],
  }
}

describe("SuggestionRequestInputSchema", () => {
  it("accepts the calibrated festival duration", () => {
    const parsed = SuggestionRequestInputSchema.parse({
      ...baseInput(),
      durationMinutes: 360,
      stepMinutes: 30,
      dayStart: "08:00",
      dayEnd: "18:00",
      eventArchetypeId: "festival",
    })

    expect(parsed.durationMinutes).toBe(360)
    expect(parsed.eventArchetypeId).toBe("festival")
    expect(MAX_EVENT_DURATION_MINUTES).toBe(360)
  })

  it("rejects durations above every archetype", () => {
    const parsed =
      SuggestionRequestInputSchema.safeParse({
        ...baseInput(),
        durationMinutes: 361,
      })

    expect(parsed.success).toBe(false)
  })

  it("defaults the event archetype for old clients", () => {
    const parsed =
      SuggestionRequestInputSchema.parse(baseInput())

    expect(parsed.eventArchetypeId).toBe(
      "general_meeting",
    )
  })
})

describe("normalizeSuggestionRequestTargets", () => {
  it("defaults omitted targets to all unique attendees", () => {
    const normalized =
      normalizeSuggestionRequestTargets({
        attendeeUserIds: ["b", "a", "b"],
      })

    expect(normalized.attendeeUserIds).toEqual([
      "a",
      "b",
    ])

    expect(normalized.targetUserIds).toEqual([
      "a",
      "b",
    ])

    expect(
      normalized.invalidTargetUserIds,
    ).toEqual([])
  })

  it("preserves and normalizes an explicit subset", () => {
    const normalized =
      normalizeSuggestionRequestTargets({
        attendeeUserIds: ["c", "a", "b"],
        targetUserIds: ["c", "a", "c"],
      })

    expect(normalized.targetUserIds).toEqual([
      "a",
      "c",
    ])

    expect(
      normalized.invalidTargetUserIds,
    ).toEqual([])
  })

  it("identifies targets outside the attendee set", () => {
    const normalized =
      normalizeSuggestionRequestTargets({
        attendeeUserIds: ["a", "b"],
        targetUserIds: ["b", "outside"],
      })

    expect(
      normalized.invalidTargetUserIds,
    ).toEqual(["outside"])
  })
})
