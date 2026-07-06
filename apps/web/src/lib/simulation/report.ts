import { DateTime } from "luxon"

import { runEventScenario, type EventAwareCandidate, type EventScenarioResult } from "./event-aware"
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

function recommendationQuality(candidate: EventAwareCandidate | undefined) {
  if (!candidate) return "No viable slot"

  const score = candidate.eventAwareScore.total
  const target = candidate.eventAwareScore.targetTurnout
  const broad = candidate.eventAwareScore.broadTurnout

  if (score >= 0.8 && target >= 0.65) return "Strong"
  if (score >= 0.65 && target >= 0.5) return "Usable"
  if (score >= 0.5 || broad >= 0.5) return "Weak but possible"
  return "Poor"
}

function findNearMiss(candidates: EventAwareCandidate[]) {
  if (candidates.length < 2) return undefined

  const top = candidates[0]
  const rest = candidates.slice(1, 25)

  return rest.find((candidate) => {
    const differentDay =
      DateTime.fromISO(candidate.startAt, { zone: "utc" }).toISODate() !==
      DateTime.fromISO(top.startAt, { zone: "utc" }).toISODate()

    const closeScore =
      top.eventAwareScore.total - candidate.eventAwareScore.total <= 0.05

    const betterTarget =
      candidate.eventAwareScore.targetTurnout > top.eventAwareScore.targetTurnout

    return differentDay && (closeScore || betterTarget)
  }) ?? rest[0]
}

function summarizeWhy(candidate: EventAwareCandidate | undefined) {
  if (!candidate) return ["No candidate was generated."]

  const reasons: string[] = []

  reasons.push(
    `It has ${fmtPercent(candidate.eventAwareScore.targetTurnout)} target turnout and ${fmtPercent(candidate.eventAwareScore.broadTurnout)} whole-org turnout.`,
  )

  if (candidate.eventAwareScore.timeFit >= 0.9) {
    reasons.push("It fits the preferred time window for this event type.")
  } else if (candidate.eventAwareScore.timeFit >= 0.7) {
    reasons.push("It is acceptable for this event type, but not a perfect time-window match.")
  } else {
    reasons.push("It is outside the strongest preferred window, so the time fit is a concern.")
  }

  if (candidate.eventAwareScore.fairness >= 0.9) {
    reasons.push("The fairness score is high.")
  } else if (candidate.eventAwareScore.fairness < 0.5) {
    reasons.push("The fairness score is low, so one or more available attendees may be burdened.")
  }

  if (candidate.warnings.length) {
    reasons.push(`Warnings: ${candidate.warnings.join(" ")}`)
  }

  return reasons
}

function formatCandidateSummary(
  scenario: EventScenarioResult,
  candidate: EventAwareCandidate | undefined,
  timeZone: string,
) {
  if (!candidate) return "- No viable candidate."

  return [
    `- Time: ${fmtLocalRange(candidate.startAt, candidate.endAt, timeZone)}`,
    `- Event score: ${fmtPercent(candidate.eventAwareScore.total)}`,
    `- Target turnout: ${candidate.targetAvailableUserIds.length}/${scenario.targetUserIds.length} (${fmtPercent(candidate.eventAwareScore.targetTurnout)})`,
    `- Whole-org turnout: ${candidate.availableUserIds.length}/${scenario.totalMembers} (${fmtPercent(candidate.eventAwareScore.broadTurnout)})`,
    `- Time fit: ${fmtPercent(candidate.eventAwareScore.timeFit)}`,
    `- Fairness: ${fmtPercent(candidate.eventAwareScore.fairness)}`,
  ].join("\n")
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

  lines.push(`## Recommendation summary`)
  lines.push("")
  lines.push(`| Scenario | Quality | Best time | Event score | Target turnout | Whole-org turnout | Main warning |`)
  lines.push(`|---|---|---|---:|---:|---:|---|`)

  for (const scenario of result.scenarios) {
    const top = scenario.candidates[0]
    const warning = top?.warnings[0] ?? ""
    lines.push(
      [
        `| ${scenario.label}`,
        recommendationQuality(top),
        top ? fmtLocalRange(top.startAt, top.endAt, result.org.timeZone) : "No viable slot",
        top ? fmtPercent(top.eventAwareScore.total) : "n/a",
        top ? `${top.targetAvailableUserIds.length}/${scenario.targetUserIds.length} (${fmtPercent(top.eventAwareScore.targetTurnout)})` : "n/a",
        top ? `${top.availableUserIds.length}/${scenario.totalMembers} (${fmtPercent(top.eventAwareScore.broadTurnout)})` : "n/a",
        warning,
      ].join(" | ") + " |",
    )
  }
  lines.push("")

  lines.push(`## Scenario details`)
  lines.push("")

  for (const scenario of result.scenarios) {
    const top = scenario.candidates[0]
    const nearMiss = findNearMiss(scenario.candidates)

    lines.push(`### ${scenario.label}`)
    lines.push("")
    lines.push(scenario.description)
    lines.push("")
    lines.push(`Base archetype: ${scenario.archetype.label}`)
    lines.push(`Target tags: ${scenario.targetTags.join(", ")}`)
    lines.push(`Calendar examples: ${scenario.examplesFromCalendar.join("; ")}`)
    lines.push(`Target members: ${scenario.targetUserIds.length} of ${scenario.totalMembers}`)
    lines.push(`Recommendation quality: ${recommendationQuality(top)}`)
    lines.push("")

    lines.push(`#### Best recommendation`)
    lines.push("")
    lines.push(formatCandidateSummary(scenario, top, result.org.timeZone))
    lines.push("")

    lines.push(`Why this won:`)
    for (const reason of summarizeWhy(top)) {
      lines.push(`- ${reason}`)
    }
    lines.push("")

    if (nearMiss) {
      lines.push(`#### Near-miss alternative`)
      lines.push("")
      lines.push(formatCandidateSummary(scenario, nearMiss, result.org.timeZone))
      lines.push("")
    }

    const topTen = scenario.candidates.slice(0, 10)
    if (!topTen.length) {
      lines.push(`No viable candidates were generated.`)
      lines.push("")
      continue
    }

    lines.push(`#### Top 10 candidates`)
    lines.push("")
    lines.push(`| Rank | Date/time | Event score | Target turnout | Whole-org turnout | Time fit | Fairness | Warnings |`)
    lines.push(`|---:|---|---:|---:|---:|---:|---:|---|`)

    for (const candidate of topTen) {
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
