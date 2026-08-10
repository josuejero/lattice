import { describe, expect, it } from "vitest"

import { runEventScenario } from "./event-aware"
import { generateMockOrg } from "./mock-org"
import { runMockSimulation } from "./report"
import { PLANNING_SCENARIOS } from "./event-scenarios"

describe("mock event simulation", () => {
  it("generates a deterministic 50-member mock org", () => {
    const a = generateMockOrg({ seed: 123, memberCount: 50 })
    const b = generateMockOrg({ seed: 123, memberCount: 50 })

    expect(a.members).toEqual(b.members)
    expect(a.members).toHaveLength(50)
    expect(a.members.every((member) => member.windows.length > 0)).toBe(true)
  })

  it(
    "runs every event archetype and returns ranked candidates",
    () => {
      const result = runMockSimulation({
        seed: 20260705,
        memberCount: 24,
        monthStart: "2026-08-01",
        monthEnd: "2026-08-31",
        maxCandidatesPerScenario: 120,
      })

      expect(result.scenarios.length).toBe(Object.keys(PLANNING_SCENARIOS).length)

      for (const scenario of result.scenarios) {
        expect(scenario.candidates.length).toBeGreaterThan(0)
        expect(scenario.candidates[0].eventAwareRank).toBe(1)
        expect(scenario.candidates[0].eventAwareScore.total).toBeGreaterThan(0)
        expect(scenario.candidates[0].eventAwareScore.total).toBeLessThanOrEqual(1)
      }
    },
    60_000,
  )

  it("weights target turnout separately from whole-org turnout", () => {
    const org = generateMockOrg({
      seed: 42,
      memberCount: 50,
      monthStart: "2026-08-01",
      monthEnd: "2026-08-31",
    })

    const scenario = runEventScenario({
      org,
      archetypeId: "canvass",
      maxCandidates: 500,
    })

    const top = scenario.candidates[0]

    expect(scenario.targetUserIds.length).toBeGreaterThan(0)
    expect(top.targetAvailableUserIds.length).toBeLessThanOrEqual(scenario.targetUserIds.length)
    expect(top.availableUserIds.length).toBeLessThanOrEqual(org.members.length)
  }, 15_000)
  it("targets specific branch members instead of all branch members", () => {
    const org = generateMockOrg({
      seed: 20260705,
      memberCount: 50,
      monthStart: "2026-08-01",
      monthEnd: "2026-08-31",
    })

    const springfield = runEventScenario({
      org,
      planningScenarioId: "springfield_branch_meeting",
      maxCandidates: 120,
    })

    const franklin = runEventScenario({
      org,
      planningScenarioId: "franklin_branch_meeting",
      maxCandidates: 120,
    })

    expect(springfield.targetUserIds.length).toBeGreaterThan(0)
    expect(franklin.targetUserIds.length).toBeGreaterThan(0)
    expect(springfield.targetUserIds.length).toBeLessThan(org.members.length)
    expect(franklin.targetUserIds.length).toBeLessThan(org.members.length)
    expect(new Set(springfield.targetUserIds)).not.toEqual(new Set(franklin.targetUserIds))
  })

})
