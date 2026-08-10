export const COMPARISON_SUMMARY_COLUMNS = [
  "scenario_id",
  "scenario_label",
  "runs",
  "most_common_quality",
  "most_common_quality_count",
  "most_common_quality_share",
  "unique_best_slots",
  "most_common_slot",
  "most_common_slot_count",
  "most_common_slot_share",
  "unique_best_patterns",
  "most_common_pattern",
  "most_common_pattern_count",
  "most_common_pattern_share",
  "pattern_stability",
  "avg_score",
  "avg_target_turnout",
  "warning_runs",
  "low_target_turnout_runs",
  "low_fairness_runs",
  "weak_time_fit_runs",
] as const

export const COMPARISON_MARKDOWN_COLUMNS = [
  "Scenario",
  "Runs",
  "Most common quality",
  "Quality share",
  "Unique exact slots",
  "Exact slot repeatability",
  "Most common pattern",
  "Pattern share",
  "Pattern stability",
  "Avg score",
  "Avg target turnout",
  "Warning runs",
  "Low target runs",
  "Low fairness runs",
  "Weak time-fit runs",
] as const

const COMPARISON_MARKDOWN_ALIGNMENTS = [
  "---",
  "---:",
  "---",
  "---:",
  "---:",
  "---:",
  "---",
  "---:",
  "---",
  "---:",
  "---:",
  "---:",
  "---:",
  "---:",
  "---:",
] as const

export function orderComparisonSummaryRow(
  row: Record<string, string>,
) {
  return Object.fromEntries(
    COMPARISON_SUMMARY_COLUMNS.map(
      (column) => [column, row[column] ?? ""],
    ),
  ) as Record<string, string>
}

export function comparisonMarkdownHeader() {
  return `| ${COMPARISON_MARKDOWN_COLUMNS.join(" | ")} |`
}

export function comparisonMarkdownSeparator() {
  return `|${COMPARISON_MARKDOWN_ALIGNMENTS.join("|")}|`
}
