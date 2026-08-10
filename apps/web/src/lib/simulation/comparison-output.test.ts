import { describe, expect, it } from "vitest"

import {
  COMPARISON_MARKDOWN_COLUMNS,
  COMPARISON_SUMMARY_COLUMNS,
  comparisonMarkdownHeader,
  comparisonMarkdownSeparator,
  orderComparisonSummaryRow,
} from "./comparison-output"

describe("mock simulation comparison output schema", () => {
  it("separates exact-slot repeatability from scheduling-pattern stability", () => {
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "warning_runs",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "low_target_turnout_runs",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "low_fairness_runs",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "weak_time_fit_runs",
    )

    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "unique_best_slots",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "most_common_slot_share",
    )

    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "unique_best_patterns",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "most_common_pattern",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "most_common_pattern_share",
    )
    expect(COMPARISON_SUMMARY_COLUMNS).toContain(
      "pattern_stability",
    )

    expect(COMPARISON_SUMMARY_COLUMNS).not.toContain(
      "slot_stability",
    )

    const ordered = orderComparisonSummaryRow({
      scenario_id: "example",
      slot_stability: "should-not-leak",
    })

    expect(Object.keys(ordered)).toEqual([
      ...COMPARISON_SUMMARY_COLUMNS,
    ])

    expect(ordered).not.toHaveProperty(
      "slot_stability",
    )
  })

  it("keeps comparison markdown aligned with the CSV schema", () => {
    expect(COMPARISON_MARKDOWN_COLUMNS).toEqual([
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
    ])

    expect(COMPARISON_MARKDOWN_COLUMNS).not.toContain(
      "Slot stability",
    )

    const header = comparisonMarkdownHeader()
    const separator = comparisonMarkdownSeparator()

    expect(header).toBe(
      `| ${COMPARISON_MARKDOWN_COLUMNS.join(" | ")} |`,
    )

    expect(
      separator.split("|").filter(Boolean),
    ).toHaveLength(
      COMPARISON_MARKDOWN_COLUMNS.length,
    )
  })
})
