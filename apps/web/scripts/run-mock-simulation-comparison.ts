import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { simulationSummaryToCsv } from "../src/lib/simulation/csv"
import { runMockSimulation } from "../src/lib/simulation/report"

type CsvRow = Record<string, string>

type ScenarioAggregate = {
  scenarioId: string
  scenarioLabel: string
  runs: number
  qualityCounts: Map<string, number>
  slotCounts: Map<string, number>
  scoreValues: number[]
  targetTurnoutValues: number[]
  warningCount: number
}

const DEFAULT_SEEDS = [20260701, 20260702, 20260703, 20260704, 20260705]
const outDir = join(process.cwd(), "tmp", "mock-simulation")

function parseSeeds(): number[] {
  const raw = process.env.MOCK_SIM_SEEDS?.trim()
  if (!raw) return DEFAULT_SEEDS

  const parsed = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((seed) => Number.isFinite(seed))

  if (parsed.length === 0) {
    console.warn("No valid MOCK_SIM_SEEDS values found. Using defaults.")
    return DEFAULT_SEEDS
  }

  return parsed
}

function parseMonths(): Array<{ monthStart: string; monthEnd: string }> {
  const raw = process.env.MOCK_SIM_MONTHS?.trim()
  if (!raw) {
    return [{ monthStart: "2026-08-01", monthEnd: "2026-08-31" }]
  }

  const months: Array<{ monthStart: string; monthEnd: string }> = []

  for (const entry of raw.split(",")) {
    const month = entry.trim()
    const [yearRaw, monthRaw] = month.split("-")
    const year = Number.parseInt(yearRaw ?? "", 10)
    const monthNumber = Number.parseInt(monthRaw ?? "", 10)

    if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
      console.warn(`Skipping invalid MOCK_SIM_MONTHS entry: ${month}`)
      continue
    }

    const monthStart = `${year}-${String(monthNumber).padStart(2, "0")}-01`
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
    const monthEnd = `${year}-${String(monthNumber).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

    months.push({ monthStart, monthEnd })
  }

  if (months.length === 0) {
    console.warn("No valid MOCK_SIM_MONTHS values found. Using August 2026.")
    return [{ monthStart: "2026-08-01", monthEnd: "2026-08-31" }]
  }

  return months
}

function parseCsv(csv: string): CsvRow[] {
  const lines = csv.trimEnd().split(/\r?\n/)
  if (lines.length <= 1) return []

  const headers = parseCsvLine(lines[0])

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: CsvRow = {}

    headers.forEach((header, index) => {
      row[header] = values[index] ?? ""
    })

    return row
  })
}

function parseCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const next = line[i + 1]

    if (char === '"' && inQuotes && next === '"') {
      current += '"'
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      values.push(current)
      current = ""
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function csvEscape(value: unknown): string {
  const text = String(value ?? "")
  if (!/[",\n\r]/.test(text)) return text
  return `"${text.replaceAll('"', '""')}"`
}

function rowsToCsv(rows: CsvRow[]): string {
  if (rows.length === 0) return ""

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  )

  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n") + "\n"
}

function firstValue(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key]
    if (value !== undefined && value !== "") return value
  }

  return ""
}

function firstNumber(row: CsvRow, keys: string[]): number | null {
  const raw = firstValue(row, keys)
  if (!raw) return null

  const value = Number.parseFloat(raw.replace("%", ""))
  return Number.isFinite(value) ? value : null
}

function slotKey(row: CsvRow): string {
  const bestStart = firstValue(row, ["best_start_local", "bestStartLocal"])
  const bestEnd = firstValue(row, ["best_end_local", "bestEndLocal"])

  if (bestStart || bestEnd) {
    return [bestStart, bestEnd].filter(Boolean).join(" to ")
  }

  const date = firstValue(row, ["date", "best_date", "start_date", "candidate_date"])
  const day = firstValue(row, ["day", "best_day", "day_label", "weekday"])
  const time = firstValue(row, ["time", "best_time", "start_time", "candidate_time"])
  const label = firstValue(row, ["slot", "slot_label", "recommendation", "best_recommendation"])

  return [date, day, time, label].filter(Boolean).join(" ") || "unknown"
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function mostCommon(map: Map<string, number>): { key: string; count: number; share: number } {
  let bestKey = ""
  let bestCount = 0
  let total = 0

  for (const [key, count] of map.entries()) {
    total += count
    if (count > bestCount) {
      bestKey = key
      bestCount = count
    }
  }

  return {
    key: bestKey,
    count: bestCount,
    share: total > 0 ? bestCount / total : 0,
  }
}

function average(values: number[]): string {
  if (values.length === 0) return ""
  return (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4)
}

function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "unknown"

  const seconds = Math.round(totalSeconds)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes <= 0) return `${remainingSeconds}s`
  return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`
}

function progressBar(completed: number, total: number, startedAt: number): string {
  const width = 24
  const ratio = total > 0 ? completed / total : 1
  const filled = Math.round(ratio * width)
  const percent = Math.round(ratio * 100)
  const elapsedSeconds = (Date.now() - startedAt) / 1000
  const averageSecondsPerRun = completed > 0 ? elapsedSeconds / completed : 0
  const remainingRuns = Math.max(total - completed, 0)
  const etaSeconds = completed > 0 ? averageSecondsPerRun * remainingRuns : 0

  return `[${"#".repeat(filled)}${"-".repeat(width - filled)}] ${percent}% (${completed}/${total}) ETA ${formatDuration(etaSeconds)}`
}

async function main(): Promise<void> {
  const seeds = parseSeeds()
  const months = parseMonths()
  const memberCount = Number.parseInt(process.env.MOCK_SIM_MEMBER_COUNT ?? "50", 10)
  const maxCandidatesPerScenario = Number.parseInt(
    process.env.MOCK_SIM_MAX_CANDIDATES_PER_SCENARIO ?? "80",
    10,
  )

  const runRows: CsvRow[] = []
  const aggregates = new Map<string, ScenarioAggregate>()

  await mkdir(outDir, { recursive: true })

  const totalRuns = seeds.length * months.length
  const startedAt = Date.now()
  let completedRuns = 0

  console.log(`Running ${totalRuns} simulation run${totalRuns === 1 ? "" : "s"}...`)
  console.log(progressBar(completedRuns, totalRuns, startedAt))

  for (const seed of seeds) {
    for (const month of months) {
      console.log(`Seed ${seed}, ${month.monthStart} to ${month.monthEnd}`)

      const result = runMockSimulation({
        seed,
        memberCount,
        monthStart: month.monthStart,
        monthEnd: month.monthEnd,
        maxCandidatesPerScenario,
      })

      completedRuns += 1
      console.log(progressBar(completedRuns, totalRuns, startedAt))

      const rows = parseCsv(simulationSummaryToCsv(result))

      for (const row of rows) {
        const scenarioId = firstValue(row, ["scenario_id", "scenarioId", "id"]) || "unknown"
        const scenarioLabel =
          firstValue(row, ["scenario_label", "scenarioLabel", "label", "title"]) || scenarioId
        const quality = firstValue(row, ["quality", "quality_label", "qualityLabel"]) || "unknown"
        const warning = firstValue(row, ["main_warning", "warning", "warnings"])
        const slot = slotKey(row)

        runRows.push({
          seed: String(seed),
          month_start: month.monthStart,
          month_end: month.monthEnd,
          ...row,
        })

        const aggregate =
          aggregates.get(scenarioId) ??
          {
            scenarioId,
            scenarioLabel,
            runs: 0,
            qualityCounts: new Map<string, number>(),
            slotCounts: new Map<string, number>(),
            scoreValues: [],
            targetTurnoutValues: [],
            warningCount: 0,
          }

        aggregate.runs += 1
        increment(aggregate.qualityCounts, quality)
        increment(aggregate.slotCounts, slot)

        const score = firstNumber(row, [
          "event_score",
          "eventScore",
          "total_score",
          "score",
          "best_score",
          "final_score",
          "weighted_score",
        ])
        if (score !== null) aggregate.scoreValues.push(score)

        const targetTurnout = firstNumber(row, [
          "target_turnout",
          "target_turnout_pct",
          "targetTurnout",
          "best_target_turnout",
          "best_target_turnout_pct",
        ])
        if (targetTurnout !== null) aggregate.targetTurnoutValues.push(targetTurnout)

        if (warning && warning.toLowerCase() !== "none") aggregate.warningCount += 1

        aggregates.set(scenarioId, aggregate)
      }
    }
  }

  const aggregateRows: CsvRow[] = Array.from(aggregates.values())
    .sort((a, b) => a.scenarioId.localeCompare(b.scenarioId))
    .map((aggregate) => {
      const quality = mostCommon(aggregate.qualityCounts)
      const slot = mostCommon(aggregate.slotCounts)

      return {
        scenario_id: aggregate.scenarioId,
        scenario_label: aggregate.scenarioLabel,
        runs: String(aggregate.runs),
        most_common_quality: quality.key,
        most_common_quality_count: String(quality.count),
        most_common_quality_share: quality.share.toFixed(4),
        unique_best_slots: String(aggregate.slotCounts.size),
        most_common_slot: slot.key,
        most_common_slot_count: String(slot.count),
        most_common_slot_share: slot.share.toFixed(4),
        avg_score: average(aggregate.scoreValues),
        avg_target_turnout: average(aggregate.targetTurnoutValues),
        warning_runs: String(aggregate.warningCount),
      }
    })

  const runsCsvPath = join(outDir, "mock-event-comparison-runs.csv")
  const summaryCsvPath = join(outDir, "mock-event-comparison-summary.csv")
  const markdownPath = join(outDir, "mock-event-comparison.md")

  await writeFile(runsCsvPath, rowsToCsv(runRows), "utf8")
  await writeFile(summaryCsvPath, rowsToCsv(aggregateRows), "utf8")
  await writeFile(
    markdownPath,
    [
      "# Mock event simulation comparison",
      "",
      `Seeds: ${seeds.join(", ")}`,
      `Months: ${months.map((month) => `${month.monthStart} to ${month.monthEnd}`).join(", ")}`,
      `Runs per scenario: ${seeds.length * months.length}`,
      "",
      "## Scenario stability summary",
      "",
      "| Scenario | Runs | Most common quality | Quality share | Unique best slots | Most common slot share | Avg score | Avg target turnout | Warning runs |",
      "|---|---:|---|---:|---:|---:|---:|---:|---:|",
      ...aggregateRows
        .map((row) =>
          [
            row.scenario_label,
            row.runs,
            row.most_common_quality,
            row.most_common_quality_share,
            row.unique_best_slots,
            row.most_common_slot_share,
            row.avg_score,
            row.avg_target_turnout,
            row.warning_runs,
          ]
            .map((value) => String(value ?? "").replaceAll("|", "\\|"))
            .join(" | "),
        )
        .map((line) => `| ${line} |`),
      "",
      "## Files",
      "",
      `- ${runsCsvPath}`,
      `- ${summaryCsvPath}`,
      `- ${markdownPath}`,
      "",
    ].join("\n"),
    "utf8",
  )

  console.log("")
  console.log("Comparison files written:")
  console.log(`- ${runsCsvPath}`)
  console.log(`- ${summaryCsvPath}`)
  console.log(`- ${markdownPath}`)
}

main().catch((error: unknown) => {
  console.error("")
  console.error("Comparison script error:")
  console.error(error)
  console.error("")
  console.error("Terminal was not closed. Fix the error above, then rerun the command.")
})
