import { describe, expect, it } from "vitest"

import {
  DEFAULT_EVENT_ARCHETYPE,
  DEFAULT_EVENT_ARCHETYPE_ID,
  DURATION_OPTIONS,
  effectiveTargetUserIds,
  eventArchetypeFormDefaults,
} from "./form-contract"

describe("suggestion form contract", () => {
  it("uses calibrated general-meeting defaults", () => {
    expect(DEFAULT_EVENT_ARCHETYPE_ID).toBe(
      "general_meeting",
    )

    expect(
      eventArchetypeFormDefaults(
        DEFAULT_EVENT_ARCHETYPE_ID,
      ),
    ).toEqual({
      durationMinutes: 150,
      stepMinutes: 15,
      dayStart: "09:00",
      dayEnd: "21:00",
    })

    expect(
      DEFAULT_EVENT_ARCHETYPE.broadAudience,
    ).toBe(true)
  })

  it("includes every archetype duration option", () => {
    expect(DURATION_OPTIONS).toContain(150)
    expect(DURATION_OPTIONS).toContain(360)

    expect(DURATION_OPTIONS).toEqual(
      [...DURATION_OPTIONS].sort((a, b) => a - b),
    )
  })

  it("uses all attendees for broad-audience events", () => {
    const result = effectiveTargetUserIds({
      eventArchetypeId: "general_meeting",
      selectedUserIds: ["a", "b", "c"],
      targetUserIds: ["a"],
    })

    expect(result).toEqual(["a", "b", "c"])
  })

  it("uses the explicit subset for targeted events", () => {
    const result = effectiveTargetUserIds({
      eventArchetypeId: "committee_meeting",
      selectedUserIds: ["a", "b", "c"],
      targetUserIds: ["a", "c"],
    })

    expect(result).toEqual(["a", "c"])
  })

  it("uses the calibrated festival controls", () => {
    expect(
      eventArchetypeFormDefaults("festival"),
    ).toEqual({
      durationMinutes: 360,
      stepMinutes: 30,
      dayStart: "08:00",
      dayEnd: "18:00",
    })
  })
})
