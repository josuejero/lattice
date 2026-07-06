import { DateTime } from "luxon"

import type { MockSimulationResult } from "./report"

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value)

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }

  return text
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",")
}

function fmtLocal(startISO: string, timeZone: string) {
  return DateTime.fromISO(startISO, { zone: "utc" })
    .setZone(timeZone)
    .toFormat("yyyy-LL-dd HH:mm")
}

export function simulationSummaryToCsv(result: MockSimulationResult) {
  const rows: unknown[][] = [
    [
      "scenario_id",
      "scenario_label",
      "quality",
      "base_archetype",
      "target_tags",
      "best_start_local",
      "best_end_local",
      "event_score",
      "target_available",
      "target_total",
      "target_turnout",
      "whole_org_available",
      "whole_org_total",
      "whole_org_turnout",
      "time_fit",
      "fairness",
      "warning_count",
      "main_warning",
    ],
  ]

  for (const scenario of result.scenarios) {
    const top = scenario.candidates[0]

    rows.push([
      scenario.id,
      scenario.label,
      top ? recommendationQualityCsv(top.eventAwareScore.total, top.eventAwareScore.targetTurnout, top.eventAwareScore.broadTurnout) : "No viable slot",
      scenario.archetype.label,
      scenario.targetTags.join(";"),
      top ? fmtLocal(top.startAt, result.org.timeZone) : "",
      top ? fmtLocal(top.endAt, result.org.timeZone) : "",
      top?.eventAwareScore.total ?? "",
      top?.targetAvailableUserIds.length ?? "",
      scenario.targetUserIds.length,
      top?.eventAwareScore.targetTurnout ?? "",
      top?.availableUserIds.length ?? "",
      scenario.totalMembers,
      top?.eventAwareScore.broadTurnout ?? "",
      top?.eventAwareScore.timeFit ?? "",
      top?.eventAwareScore.fairness ?? "",
      top?.warnings.length ?? "",
      top?.warnings[0] ?? "",
    ])
  }

  return rows.map(csvRow).join("\n") + "\n"
}

export function simulationCandidatesToCsv(result: MockSimulationResult) {
  const rows: unknown[][] = [
    [
      "scenario_id",
      "scenario_label",
      "base_archetype",
      "rank",
      "start_local",
      "end_local",
      "start_utc",
      "end_utc",
      "event_score",
      "target_available",
      "target_total",
      "target_turnout",
      "whole_org_available",
      "whole_org_total",
      "whole_org_turnout",
      "time_fit",
      "fairness",
      "inconvenience",
      "warnings",
      "available_user_ids",
      "target_available_user_ids",
      "target_missing_user_ids",
    ],
  ]

  for (const scenario of result.scenarios) {
    for (const candidate of scenario.candidates.slice(0, 25)) {
      rows.push([
        scenario.id,
        scenario.label,
        scenario.archetype.label,
        candidate.eventAwareRank,
        fmtLocal(candidate.startAt, result.org.timeZone),
        fmtLocal(candidate.endAt, result.org.timeZone),
        candidate.startAt,
        candidate.endAt,
        candidate.eventAwareScore.total,
        candidate.targetAvailableUserIds.length,
        scenario.targetUserIds.length,
        candidate.eventAwareScore.targetTurnout,
        candidate.availableUserIds.length,
        scenario.totalMembers,
        candidate.eventAwareScore.broadTurnout,
        candidate.eventAwareScore.timeFit,
        candidate.eventAwareScore.fairness,
        candidate.eventAwareScore.inconvenience,
        candidate.warnings.join(" | "),
        candidate.availableUserIds.join(";"),
        candidate.targetAvailableUserIds.join(";"),
        candidate.targetMissingUserIds.join(";"),
      ])
    }
  }

  return rows.map(csvRow).join("\n") + "\n"
}

function recommendationQualityCsv(score: number, target: number, broad: number) {
  if (score >= 0.8 && target >= 0.65) return "Strong"
  if (score >= 0.65 && target >= 0.5) return "Usable"
  if (score >= 0.5 || broad >= 0.5) return "Weak but possible"
  return "Poor"
}
