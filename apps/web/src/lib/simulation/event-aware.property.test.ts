import { expect, it } from "vitest"
import * as fc from "fast-check"

import { runEventScenario } from "./event-aware"
import { generateMockOrg } from "./mock-org"

it(
  "event-aware candidates stay ranked and bounded for many deterministic seeds",
  () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 999_999 }), (seed) => {
        const org = generateMockOrg({
          seed,
          memberCount: 18,
          monthStart: "2026-08-01",
          monthEnd: "2026-08-31",
        })

        const scenario = runEventScenario({
          org,
          archetypeId: "committee_meeting",
          maxCandidates: 120,
        })

        for (let i = 0; i < scenario.candidates.length; i += 1) {
          const candidate = scenario.candidates[i]

          expect(candidate.eventAwareRank).toBe(i + 1)

          expect(candidate.eventAwareScore.total).toBeGreaterThanOrEqual(0)
          expect(candidate.eventAwareScore.total).toBeLessThanOrEqual(1)

          expect(candidate.eventAwareScore.targetTurnout).toBeGreaterThanOrEqual(0)
          expect(candidate.eventAwareScore.targetTurnout).toBeLessThanOrEqual(1)

          expect(candidate.eventAwareScore.broadTurnout).toBeGreaterThanOrEqual(0)
          expect(candidate.eventAwareScore.broadTurnout).toBeLessThanOrEqual(1)

          expect(candidate.eventAwareScore.timeFit).toBeGreaterThanOrEqual(0)
          expect(candidate.eventAwareScore.timeFit).toBeLessThanOrEqual(1)

          expect(candidate.targetAvailableUserIds.length).toBeLessThanOrEqual(
            scenario.targetUserIds.length,
          )
          expect(candidate.availableUserIds.length).toBeLessThanOrEqual(org.members.length)
        }
      }),
      {
        numRuns: 20,
        endOnFailure: true,
      },
    )
  },
  20_000,
)
