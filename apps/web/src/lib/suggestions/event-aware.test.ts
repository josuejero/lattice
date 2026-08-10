import { describe, expect, it } from "vitest"

import { EVENT_ARCHETYPES } from "./event-archetypes"
import {
  rankEventAwareCandidates,
  scoreEventAwareCandidate,
} from "./event-aware"
import type { SuggestionCandidate } from "./engine"

function candidate(args: {
  startAt?: string
  availableUserIds: string[]
  attendanceRatio: number
  fairness?: number
  inconvenience?: number
}): SuggestionCandidate {
  const startAt =
    args.startAt ??
    "2026-01-13T23:00:00.000Z"

  return {
    rank: 1,
    startAt,
    endAt: new Date(
      new Date(startAt).getTime() +
        2 * 60 * 60 * 1000,
    ).toISOString(),
    attendanceRatio: args.attendanceRatio,
    score: {
      total: args.attendanceRatio,
      attendance: args.attendanceRatio,
      inconvenience:
        args.inconvenience ?? 1,
      fairness: args.fairness ?? 1,
    },
    availableUserIds:
      args.availableUserIds,
    missingUserIds: [],
    explanation: {
      why: [],
    },
  }
}

describe("event-aware suggestion scoring", () => {
  it("can prefer target turnout over broader attendance", () => {
    const broadButMissesTarget = candidate({
      availableUserIds: ["a", "b", "c"],
      attendanceRatio: 0.75,
    })

    const reachesTarget = candidate({
      availableUserIds: ["target"],
      attendanceRatio: 0.25,
    })

    const ranked = rankEventAwareCandidates({
      candidates: [
        broadButMissesTarget,
        reachesTarget,
      ],
      archetype:
        EVENT_ARCHETYPES.committee_meeting,
      targetUserIds: ["target"],
      timeZone: "America/New_York",
    })

    expect(
      ranked[0]?.targetAvailableUserIds,
    ).toContain("target")

    expect(
      ranked[0]?.eventAwareScore.targetTurnout,
    ).toBe(1)
  })

  it("reports target and time-fit caveats", () => {
    const scored = scoreEventAwareCandidate({
      candidate: candidate({
        startAt:
          "2026-01-13T15:00:00.000Z",
        availableUserIds: ["a", "b", "c"],
        attendanceRatio: 0.75,
      }),
      archetype:
        EVENT_ARCHETYPES.committee_meeting,
      targetUserIds: ["target"],
      timeZone: "America/New_York",
    })

    expect(
      scored.eventAwareScore.targetTurnout,
    ).toBe(0)

    expect(scored.warnings).toContain(
      "High whole-org availability, but weak target-group availability for this event type.",
    )

    expect(scored.warnings).toContain(
      "This slot is outside the preferred time window for this event type.",
    )
  })

  it("keeps deterministic tie breaking", () => {
    const later = candidate({
      startAt:
        "2026-01-13T23:30:00.000Z",
      availableUserIds: ["target"],
      attendanceRatio: 1,
    })

    const earlier = candidate({
      startAt:
        "2026-01-13T23:00:00.000Z",
      availableUserIds: ["target"],
      attendanceRatio: 1,
    })

    const ranked = rankEventAwareCandidates({
      candidates: [later, earlier],
      archetype:
        EVENT_ARCHETYPES.committee_meeting,
      targetUserIds: ["target"],
      timeZone: "America/New_York",
    })

    expect(ranked[0]?.startAt).toBe(
      earlier.startAt,
    )

    expect(ranked.map((item) => item.eventAwareRank))
      .toEqual([1, 2])
  })
})
