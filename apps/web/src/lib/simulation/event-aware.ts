import { generateSuggestions } from "../suggestions/engine"
import {
  rankEventAwareCandidates,
  type EventAwareCandidate,
} from "../suggestions/event-aware"

export type {
  EventAwareCandidate,
  EventAwareScore,
} from "../suggestions/event-aware"
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

function intersects<T>(a: T[], b: T[]) {
  const set = new Set(a)
  return b.some((item) => set.has(item))
}

function memberMatchesTags(member: MockMember, tags: MemberTag[]) {
  return intersects(member.tags, tags)
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

  const rescored = rankEventAwareCandidates({
    candidates: baseCandidates,
    archetype: resolved.archetype,
    targetUserIds,
    timeZone: args.org.timeZone,
  })

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
