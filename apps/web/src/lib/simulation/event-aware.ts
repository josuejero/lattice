import { DateTime } from "luxon"

import { generateSuggestions, type SuggestionCandidate } from "../suggestions/engine"
import {
  EVENT_ARCHETYPES,
  type EventArchetype,
  type EventArchetypeId,
  type MemberTag,
} from "./event-archetypes"
import {
  PLANNING_SCENARIOS,
  type PlanningScenario,
  type PlanningScenarioId,
} from "./event-scenarios"
import type { MockMember, MockOrg } from "./mock-org"

export type EventAwareScore = {
  total: number
  targetTurnout: number
  broadTurnout: number
  timeFit: number
  fairness: number
  inconvenience: number
}

export type EventAwareCandidate = SuggestionCandidate & {
  eventAwareRank: number
  eventAwareScore: EventAwareScore
  targetAvailableUserIds: string[]
  targetMissingUserIds: string[]
  warnings: string[]
}

export type EventScenarioResult = {
  id: string
  label: string
  description: string
  archetype: EventArchetype
  planningScenario?: PlanningScenario
  targetTags: MemberTag[]
  targetUserIds: string[]
  totalMembers: number
  candidates: EventAwareCandidate[]
  examplesFromCalendar: string[]
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function ratio(numerator: number, denominator: number) {
  if (denominator <= 0) return 0
  return clamp01(numerator / denominator)
}

function intersects<T>(a: T[], b: T[]) {
  const set = new Set(a)
  return b.some((item) => set.has(item))
}

function memberMatchesTags(member: MockMember, tags: MemberTag[]) {
  return intersects(member.tags, tags)
}

function isInsideWindow(args: {
  startMinute: number
  endMinute: number
  windowStartMinute: number
  windowEndMinute: number
}) {
  return (
    args.startMinute >= args.windowStartMinute &&
    args.endMinute <= args.windowEndMinute
  )
}

function computeTimeFit(candidate: SuggestionCandidate, archetype: EventArchetype, timeZone: string) {
  const start = DateTime.fromISO(candidate.startAt, { zone: "utc" }).setZone(timeZone)
  const end = DateTime.fromISO(candidate.endAt, { zone: "utc" }).setZone(timeZone)

  if (!start.isValid || !end.isValid) return 0

  const startMinute = start.hour * 60 + start.minute
  const endMinute = end.hour * 60 + end.minute
  const dayOfWeek = start.weekday

  const preferred = archetype.preferredWindows.some(
    (window) =>
      window.dayOfWeek === dayOfWeek &&
      isInsideWindow({
        startMinute,
        endMinute,
        windowStartMinute: window.startMinute,
        windowEndMinute: window.endMinute,
      }),
  )

  if (preferred) return 1

  const acceptableDayBounds =
    startMinute >= archetype.dayStartMinute &&
    endMinute <= archetype.dayEndMinute

  if (!acceptableDayBounds) return 0.1

  const weekend = dayOfWeek === 6 || dayOfWeek === 7
  const evening = startMinute >= 17 * 60 && endMinute <= 21 * 60
  const daytime = startMinute >= 10 * 60 && endMinute <= 17 * 60

  if (weekend && daytime) return 0.75
  if (!weekend && evening) return 0.7
  return 0.45
}

function scoreCandidate(args: {
  candidate: SuggestionCandidate
  archetype: EventArchetype
  targetUserIds: string[]
  timeZone: string
}): EventAwareCandidate {
  const available = new Set(args.candidate.availableUserIds)
  const targetAvailableUserIds = args.targetUserIds.filter((id) => available.has(id))
  const targetMissingUserIds = args.targetUserIds.filter((id) => !available.has(id))

  const targetTurnout = ratio(targetAvailableUserIds.length, args.targetUserIds.length)
  const broadTurnout = clamp01(args.candidate.attendanceRatio)
  const timeFit = computeTimeFit(args.candidate, args.archetype, args.timeZone)
  const fairness = clamp01(args.candidate.score.fairness)
  const inconvenience = clamp01(args.candidate.score.inconvenience)

  const total = clamp01(
    args.archetype.weights.targetTurnout * targetTurnout +
      args.archetype.weights.broadTurnout * broadTurnout +
      args.archetype.weights.timeFit * timeFit +
      args.archetype.weights.fairness * fairness +
      args.archetype.weights.inconvenience * inconvenience,
  )

  const warnings: string[] = []

  if (args.targetUserIds.length === 0) {
    warnings.push("No target members matched this scenario.")
  }

  if (args.targetUserIds.length > 0 && broadTurnout >= 0.7 && targetTurnout < 0.5) {
    warnings.push(
      "High whole-org availability, but weak target-group availability for this event type.",
    )
  }

  if (timeFit < 0.5) {
    warnings.push("This slot is outside the preferred time window for this event type.")
  }

  if (fairness < 0.5) {
    warnings.push("Fairness score is low; this slot may burden at least one available attendee.")
  }

  return {
    ...args.candidate,
    eventAwareRank: 0,
    eventAwareScore: {
      total,
      targetTurnout,
      broadTurnout,
      timeFit,
      fairness,
      inconvenience,
    },
    targetAvailableUserIds,
    targetMissingUserIds,
    warnings,
  }
}

function resolveScenario(args: {
  archetypeId?: EventArchetypeId
  planningScenarioId?: PlanningScenarioId
}) {
  const planningScenario = args.planningScenarioId
    ? PLANNING_SCENARIOS[args.planningScenarioId]
    : undefined

  const archetype = EVENT_ARCHETYPES[planningScenario?.archetypeId ?? args.archetypeId ?? "general_meeting"]

  return {
    archetype,
    planningScenario,
    id: planningScenario?.id ?? archetype.id,
    label: planningScenario?.label ?? archetype.label,
    description: planningScenario?.description ?? archetype.description,
    targetTags: planningScenario?.targetTags ?? archetype.targetTags,
    broadAudience: planningScenario?.broadAudience ?? archetype.broadAudience,
    examplesFromCalendar: planningScenario?.examplesFromCalendar ?? archetype.examplesFromCalendar,
  }
}

export function runEventScenario(args: {
  org: MockOrg
  archetypeId?: EventArchetypeId
  planningScenarioId?: PlanningScenarioId
  maxCandidates?: number
}): EventScenarioResult {
  const resolved = resolveScenario({
    archetypeId: args.archetypeId,
    planningScenarioId: args.planningScenarioId,
  })

  const targetMembers = resolved.broadAudience
    ? args.org.members
    : args.org.members.filter((member) => memberMatchesTags(member, resolved.targetTags))

  const targetUserIds = targetMembers.map((member) => member.userId)

  const baseCandidates = generateSuggestions({
    timeZone: args.org.timeZone,
    rangeStart: args.org.monthStart,
    rangeEnd: args.org.monthEnd,
    durationMinutes: resolved.archetype.durationMinutes,
    stepMinutes: resolved.archetype.stepMinutes,
    dayStartMinute: resolved.archetype.dayStartMinute,
    dayEndMinute: resolved.archetype.dayEndMinute,
    attendees: args.org.members,
    maxCandidates: args.maxCandidates ?? 500,
  })

  const rescored = baseCandidates
    .map((candidate) =>
      scoreCandidate({
        candidate,
        archetype: resolved.archetype,
        targetUserIds,
        timeZone: args.org.timeZone,
      }),
    )
    .sort((a, b) => {
      const total = b.eventAwareScore.total - a.eventAwareScore.total
      if (total !== 0) return total

      const target = b.eventAwareScore.targetTurnout - a.eventAwareScore.targetTurnout
      if (target !== 0) return target

      const broad = b.eventAwareScore.broadTurnout - a.eventAwareScore.broadTurnout
      if (broad !== 0) return broad

      return new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    })
    .map((candidate, index) => ({
      ...candidate,
      eventAwareRank: index + 1,
    }))

  return {
    id: resolved.id,
    label: resolved.label,
    description: resolved.description,
    archetype: resolved.archetype,
    planningScenario: resolved.planningScenario,
    targetTags: resolved.targetTags,
    targetUserIds,
    totalMembers: args.org.members.length,
    candidates: rescored,
    examplesFromCalendar: resolved.examplesFromCalendar,
  }
}
