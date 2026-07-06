import { beforeAll, describe, expect, it } from "vitest"

import { simulationCandidatesToCsv, simulationSummaryToCsv } from "./csv"
import { runMockSimulation, type MockSimulationResult } from "./report"

describe("mock simulation CSV export", () => {
  let result: MockSimulationResult

  beforeAll(() => {
    result = runMockSimulation({
      seed: 20260705,
      memberCount: 18,
      monthStart: "2026-08-01",
      monthEnd: "2026-08-31",
      maxCandidatesPerScenario: 80,
    })
  }, 20_000)

  it("exports one summary row per scenario", () => {
    const csv = simulationSummaryToCsv(result)
    const lines = csv.trimEnd().split("\n")

    expect(lines[0]).toContain("scenario_id,scenario_label,quality")
    expect(lines.length).toBe(result.scenarios.length + 1)
    expect(csv).toContain("springfield_branch_meeting")
  })

  it("exports candidate rows", () => {
    const csv = simulationCandidatesToCsv(result)

    expect(csv).toContain("scenario_id,scenario_label,base_archetype,rank")
    expect(csv).toContain("available_user_ids")
    expect(csv.split("\n").length).toBeGreaterThan(result.scenarios.length)
  })
})
