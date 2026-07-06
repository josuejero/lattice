import { DateTime } from "luxon"

import { runEventScenario, type EventScenarioResult } from "./event-aware"
import { generateMockOrg, type MockOrg } from "./mock-org"
import { PLANNING_SCENARIO_IDS } from "./event-scenarios"

export type MockSimulationResult = {
  org: MockOrg
  scenarios: EventScenarioResult[]
}

export function runMockSimulation(options?: {
  seed?: number
  memberCount?: number
  monthStart?: string
  monthEnd?: string
  maxCandidatesPerScenario?: number
}): MockSimulationResult {
  const org = generateMockOrg({
    seed: options?.seed,
    memberCount: options?.memberCount,
    monthStart: options?.monthStart,
    monthEnd: options?.monthEnd,
  })

  const scenarios = PLANNING_SCENARIO_IDS.map((planningScenarioId) =>
    runEventScenario({
      org,
      planningScenarioId,
      maxCandidates: options?.maxCandidatesPerScenario ?? 500,
    }),
  )

  return { org, scenarios }
}

function fmtPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function fmtLocalRange(startISO: string, endISO: string, timeZone: string) {
  const start = DateTime.fromISO(startISO, { zone: "utc" }).setZone(timeZone)
  const end = DateTime.fromISO(endISO, { zone: "utc" }).setZone(timeZone)
  return `${start.toFormat("ccc, LLL d, yyyy h:mm a")}–${end.toFormat("h:mm a ZZZZ")}`
}

export function simulationToMarkdown(result: MockSimulationResult) {
  const lines: string[] = []

  lines.push(`# Mock event scheduling simulation`)
  lines.push("")
  lines.push(`Org: ${result.org.name}`)
  lines.push(`Members: ${result.org.members.length}`)
  lines.push(`Month: ${result.org.monthStart} to ${result.org.monthEnd}`)
  lines.push(`Seed: ${result.org.seed}`)
  lines.push(`Time zone: ${result.org.timeZone}`)
  lines.push("")

  lines.push(`## Member persona mix`)
  lines.push("")
  const personaCounts = new Map<string, number>()
  for (const member of result.org.members) {
    personaCounts.set(member.persona, (personaCounts.get(member.persona) ?? 0) + 1)
  }
  for (const [persona, count] of [...personaCounts.entries()].sort()) {
    lines.push(`- ${persona}: ${count}`)
  }
  lines.push("")

  lines.push(`## Scenario results`)
  lines.push("")

  for (const scenario of result.scenarios) {
    lines.push(`### ${scenario.label}`)
    lines.push("")
    lines.push(scenario.description)
    lines.push("")
    lines.push(`Base archetype: ${scenario.archetype.label}`)
    lines.push(`Target tags: ${scenario.targetTags.join(", ")}`)
    lines.push(`Calendar examples: ${scenario.examplesFromCalendar.join("; ")}`)
    lines.push(`Target members: ${scenario.targetUserIds.length} of ${scenario.totalMembers}`)
    lines.push("")

    const top = scenario.candidates.slice(0, 10)
    if (!top.length) {
      lines.push(`No viable candidates were generated.`)
      lines.push("")
      continue
    }

    lines.push(`| Rank | Date/time | Event score | Target turnout | Whole-org turnout | Time fit | Fairness | Warnings |`)
    lines.push(`|---:|---|---:|---:|---:|---:|---:|---|`)

    for (const candidate of top) {
      const warnings = candidate.warnings.length ? candidate.warnings.join(" ") : ""
      lines.push(
        [
          `| ${candidate.eventAwareRank}`,
          fmtLocalRange(candidate.startAt, candidate.endAt, result.org.timeZone),
          fmtPercent(candidate.eventAwareScore.total),
          `${candidate.targetAvailableUserIds.length}/${scenario.targetUserIds.length} (${fmtPercent(candidate.eventAwareScore.targetTurnout)})`,
          `${candidate.availableUserIds.length}/${scenario.totalMembers} (${fmtPercent(candidate.eventAwareScore.broadTurnout)})`,
          fmtPercent(candidate.eventAwareScore.timeFit),
          fmtPercent(candidate.eventAwareScore.fairness),
          warnings,
        ].join(" | ") + " |",
      )
    }

    lines.push("")
  }

  return lines.join("\n")
}
