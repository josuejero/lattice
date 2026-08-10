import { describe, expect, it } from "vitest"

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

const comparisonDir = join(process.cwd(), "tmp", "mock-simulation")
const appsWebComparisonDir = join(process.cwd(), "apps", "web", "tmp", "mock-simulation")

function existingComparisonPath(fileName: string) {
  const rootPath = join(comparisonDir, fileName)
  const appsWebPath = join(appsWebComparisonDir, fileName)

  if (existsSync(appsWebPath)) return appsWebPath
  if (existsSync(rootPath)) return rootPath

  throw new Error(
    `Missing generated comparison output ${fileName}. Run pnpm -C apps/web simulate:mock:comparison before this test.`,
  )
}

function csvHeader(path: string) {
  return readFileSync(path, "utf8").split(/\r?\n/)[0]?.split(",") ?? []
}

function markdownTableHeader(path: string) {
  const lines = readFileSync(path, "utf8").split(/\r?\n/)
  const headerLine = lines.find((line) => line.startsWith("| Scenario |"))

  if (!headerLine) {
    throw new Error(`Could not find comparison Markdown table header in ${path}`)
  }

  return headerLine
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean)
}

describe("mock simulation comparison output schema", () => {
  it("separates exact-slot repeatability from scheduling-pattern stability", () => {
    const path = existingComparisonPath("mock-event-comparison-summary.csv")
    const header = csvHeader(path)

    expect(header).toContain("warning_runs")
    expect(header).toContain("low_target_turnout_runs")
    expect(header).toContain("low_fairness_runs")
    expect(header).toContain("weak_time_fit_runs")

    expect(header).toContain("unique_best_slots")
    expect(header).toContain("most_common_slot_share")

    expect(header).toContain("unique_best_patterns")
    expect(header).toContain("most_common_pattern")
    expect(header).toContain("most_common_pattern_share")
    expect(header).toContain("pattern_stability")

    expect(header).not.toContain("slot_stability")
  })

  it("keeps comparison markdown aligned with the CSV schema", () => {
    const path = existingComparisonPath("mock-event-comparison.md")
    const header = markdownTableHeader(path)

    expect(header).toEqual([
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

    expect(header).not.toContain("Slot stability")
  })
})
