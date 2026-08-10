import { z } from "zod"

import {
  EVENT_ARCHETYPES,
  EVENT_ARCHETYPE_IDS,
} from "./event-archetypes"

export const MAX_EVENT_DURATION_MINUTES = Math.max(
  ...EVENT_ARCHETYPE_IDS.map(
    (id) => EVENT_ARCHETYPES[id].durationMinutes,
  ),
)

export const SuggestionRequestInputSchema = z.object({
  title: z.string().max(80).optional(),
  timeZone: z.string().min(1),
  rangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(MAX_EVENT_DURATION_MINUTES),
  stepMinutes: z.number().int().min(5).max(60).default(15),
  dayStart: z.string().regex(/^\d{2}:\d{2}$/).default("08:00"),
  dayEnd: z.string().regex(/^\d{2}:\d{2}$/).default("20:00"),
  eventArchetypeId: z
    .enum(EVENT_ARCHETYPE_IDS)
    .default("general_meeting"),
  targetUserIds: z.array(z.string().min(1)).min(1).optional(),
  attendeeUserIds: z.array(z.string().min(1)).min(1),
})

export type SuggestionRequestInput =
  z.infer<typeof SuggestionRequestInputSchema>

function sortedUnique(ids: string[]) {
  return [...new Set(ids)].sort()
}

export function normalizeSuggestionRequestTargets(
  input: Pick<
    SuggestionRequestInput,
    "attendeeUserIds" | "targetUserIds"
  >,
) {
  const attendeeUserIds =
    sortedUnique(input.attendeeUserIds)

  const targetUserIds =
    sortedUnique(
      input.targetUserIds ?? attendeeUserIds,
    )

  const attendeeUserIdSet =
    new Set(attendeeUserIds)

  const invalidTargetUserIds =
    targetUserIds.filter(
      (userId) => !attendeeUserIdSet.has(userId),
    )

  return {
    attendeeUserIds,
    targetUserIds,
    invalidTargetUserIds,
  }
}
