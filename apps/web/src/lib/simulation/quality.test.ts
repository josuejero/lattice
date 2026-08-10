import { describe, expect, it } from "vitest"

import {
  assessScenarioQuality,
  formatScenarioQuality,
  scenarioPatternStabilityLabel,
  scenarioQualityLabel,
  scenarioQualityThresholds,
} from "./quality"

describe("scenario quality thresholds", () => {
  it("labels score boundaries from the comparison-output distribution", () => {
    expect(scenarioQualityThresholds.usableMin).toBe(0.6)
    expect(scenarioQualityThresholds.strongMin).toBe(0.75)

    expect(scenarioQualityLabel(0.5999)).toBe("weak")
    expect(scenarioQualityLabel(0.6)).toBe("usable")
    expect(scenarioQualityLabel(0.7499)).toBe("usable")
    expect(scenarioQualityLabel(0.75)).toBe("strong")
    expect(scenarioQualityLabel(Number.NaN)).toBe("weak")
  })

  it("labels scheduling-pattern stability boundaries", () => {
    expect(scenarioPatternStabilityLabel(0.3999)).toBe("low")
    expect(scenarioPatternStabilityLabel(0.4)).toBe("medium")
    expect(scenarioPatternStabilityLabel(0.7999)).toBe("medium")
    expect(scenarioPatternStabilityLabel(0.8)).toBe("high")
    expect(scenarioPatternStabilityLabel(Number.NaN)).toBe("low")
  })

  it("keeps caveats separate from the main score label", () => {
    const assessment = assessScenarioQuality({
      score: 0.78,
      targetTurnout: 0.42,
      targetTotal: 4,
      fairness: 0,
      timeFit: 0.7,
      warningCount: 2,
      mostCommonPatternShare: 0.4,
    })

    expect(assessment.label).toBe("strong")
    expect(assessment.caveats).toEqual([
      "small target group",
      "low target turnout",
      "low fairness",
      "weaker time fit",
      "has warnings",
      "unstable scheduling pattern",
    ])
  })

  it("formats labels without hiding caveats", () => {
    expect(formatScenarioQuality({ label: "usable", caveats: [] })).toBe("usable")
    expect(
      formatScenarioQuality({
        label: "usable",
        caveats: ["low fairness", "has warnings"],
      }),
    ).toBe("usable (low fairness; has warnings)")
  })
})
