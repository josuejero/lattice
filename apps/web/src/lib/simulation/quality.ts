export type ScenarioQualityLabel = "weak" | "usable" | "strong"
export type ScenarioPatternStabilityLabel = "low" | "medium" | "high"

export interface ScenarioQualityInput {
  score: number
  targetTurnout?: number
  targetTotal?: number
  fairness?: number
  timeFit?: number
  warningCount?: number
  mostCommonPatternShare?: number
  uniqueBestPatterns?: number
}

export interface ScenarioQualityAssessment {
  label: ScenarioQualityLabel
  caveats: string[]
}

export const scenarioQualityThresholds = {
  usableMin: 0.6,
  strongMin: 0.75,
  lowTargetTurnoutBelow: 0.5,
  smallTargetTotalAtOrBelow: 5,
  lowFairnessBelow: 0.5,
  weakTimeFitBelow: 0.75,
  unstableMostCommonPatternShareBelow: 0.6,
  mediumPatternStabilityAtOrAbove: 0.4,
  highPatternStabilityAtOrAbove: 0.8,
} as const

export function scenarioQualityLabel(score: number): ScenarioQualityLabel {
  if (!Number.isFinite(score)) {
    return "weak"
  }

  if (score >= scenarioQualityThresholds.strongMin) {
    return "strong"
  }

  if (score >= scenarioQualityThresholds.usableMin) {
    return "usable"
  }

  return "weak"
}

export function scenarioPatternStabilityLabel(
  share: number,
): ScenarioPatternStabilityLabel {
  if (!Number.isFinite(share)) {
    return "low"
  }

  if (share >= scenarioQualityThresholds.highPatternStabilityAtOrAbove) {
    return "high"
  }

  if (share >= scenarioQualityThresholds.mediumPatternStabilityAtOrAbove) {
    return "medium"
  }

  return "low"
}

export function assessScenarioQuality(
  input: ScenarioQualityInput,
): ScenarioQualityAssessment {
  const label = scenarioQualityLabel(input.score)
  const caveats: string[] = []

  if (
    typeof input.targetTotal === "number" &&
    input.targetTotal > 0 &&
    input.targetTotal <= scenarioQualityThresholds.smallTargetTotalAtOrBelow
  ) {
    caveats.push("small target group")
  }

  if (
    typeof input.targetTurnout === "number" &&
    input.targetTurnout < scenarioQualityThresholds.lowTargetTurnoutBelow
  ) {
    caveats.push("low target turnout")
  }

  if (
    typeof input.fairness === "number" &&
    input.fairness < scenarioQualityThresholds.lowFairnessBelow
  ) {
    caveats.push("low fairness")
  }

  if (
    typeof input.timeFit === "number" &&
    input.timeFit < scenarioQualityThresholds.weakTimeFitBelow
  ) {
    caveats.push("weaker time fit")
  }

  if (typeof input.warningCount === "number" && input.warningCount > 0) {
    caveats.push("has warnings")
  }

  if (
    typeof input.mostCommonPatternShare === "number" &&
    input.mostCommonPatternShare <
      scenarioQualityThresholds.unstableMostCommonPatternShareBelow
  ) {
    caveats.push("unstable scheduling pattern")
  }

  if (
    typeof input.uniqueBestPatterns === "number" &&
    input.uniqueBestPatterns > 1 &&
    typeof input.mostCommonPatternShare !== "number"
  ) {
    caveats.push("multiple scheduling patterns")
  }

  return { label, caveats }
}

export function formatScenarioQuality(
  assessment: ScenarioQualityAssessment,
): string {
  if (assessment.caveats.length === 0) {
    return assessment.label
  }

  return `${assessment.label} (${assessment.caveats.join("; ")})`
}
