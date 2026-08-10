import {
  EVENT_ARCHETYPES,
  EVENT_ARCHETYPE_IDS,
  type EventArchetypeId,
} from "./event-archetypes"

export const DEFAULT_EVENT_ARCHETYPE_ID:
  EventArchetypeId = "general_meeting"

export const DEFAULT_EVENT_ARCHETYPE =
  EVENT_ARCHETYPES[DEFAULT_EVENT_ARCHETYPE_ID]

export const DURATION_OPTIONS = Array.from(
  new Set([
    15,
    30,
    45,
    60,
    90,
    120,
    ...EVENT_ARCHETYPE_IDS.map(
      (id) => EVENT_ARCHETYPES[id].durationMinutes,
    ),
  ]),
).sort((a, b) => a - b)

export function minuteToHHMM(minute: number) {
  const hour = Math.floor(minute / 60)
  const remainder = minute % 60

  return (
    `${String(hour).padStart(2, "0")}:` +
    String(remainder).padStart(2, "0")
  )
}

export function eventArchetypeFormDefaults(
  eventArchetypeId: EventArchetypeId,
) {
  const archetype =
    EVENT_ARCHETYPES[eventArchetypeId]

  return {
    durationMinutes: archetype.durationMinutes,
    stepMinutes: archetype.stepMinutes,
    dayStart: minuteToHHMM(
      archetype.dayStartMinute,
    ),
    dayEnd: minuteToHHMM(
      archetype.dayEndMinute,
    ),
  }
}

export function effectiveTargetUserIds(args: {
  eventArchetypeId: EventArchetypeId
  selectedUserIds: string[]
  targetUserIds: string[]
}) {
  return EVENT_ARCHETYPES[
    args.eventArchetypeId
  ].broadAudience
    ? args.selectedUserIds
    : args.targetUserIds
}
