import { DateTime } from "luxon"
import { createHash } from "crypto"

import type { Interval } from "@/lib/availability/intervals"
import { normalizeIntervals, subtractIntervals, unionIntervals } from "@/lib/availability/intervals"
import { overrideToLocalIntervalForDate } from "@/lib/availability/time"

export type OverrideDTO = {
  startAt: string
  endAt: string
  kind: "AVAILABLE" | "UNAVAILABLE"
}

export type WindowDTO = {
  dayOfWeek: number
  startMinute: number
  endMinute: number
}

export type AttendeeAvailabilityInput = {
  userId: string
  timeZone: string
  windows: WindowDTO[]
  overrides: OverrideDTO[]
}

export type SuggestionScores = {
  total: number
  attendance: number
  inconvenience: number
  fairness: number
}

export type SuggestionCandidate = {
  rank: number
  startAt: string
  endAt: string
  attendanceRatio: number
  score: SuggestionScores
  availableUserIds: string[]
  missingUserIds: string[]
  explanation: {
    why: string[]
    worstLocalTime?: {
      userId: string
      localStart: string
      localEnd: string
      timeZone: string
      penalty: number
    }
  }
}

export type GenerateSuggestionsInput = {
  timeZone: string
  rangeStart: string
  rangeEnd: string
  durationMinutes: number
  stepMinutes: number
  dayStartMinute: number
  dayEndMinute: number
  attendees: AttendeeAvailabilityInput[]
  maxCandidates?: number
}

export function computeRequestKey(
  input: Omit<GenerateSuggestionsInput, "attendees" | "maxCandidates"> & { attendeeUserIds: string[] },
) {
  const stable = {
    ...input,
    attendeeUserIds: [...input.attendeeUserIds].sort(),
  }
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex")
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function penaltyForLocalInterval(startMinute: number, endMinute: number) {
  const startHour = startMinute / 60
  const endHour = endMinute / 60

  if (startHour >= 9 && endHour <= 17) return 0
  if (startHour >= 8 && endHour <= 18) return 0.25
  if (startHour >= 7 && endHour <= 19) return 0.6
  return 1
}

function minutesSinceStartOfDay(dt: DateTime) {
  return Math.round(dt.diff(dt.startOf("day"), "minutes").minutes)
}

function indexOverridesByLocalDate(timeZone: string, overrides: OverrideDTO[]) {
  const map = new Map<string, OverrideDTO[]>()

  for (const override of overrides) {
    const startLocal = DateTime.fromISO(override.startAt, { zone: "utc" }).setZone(timeZone)
    const endLocal = DateTime.fromISO(override.endAt, { zone: "utc" }).setZone(timeZone)

    let cursor = startLocal.startOf("day")
    const last = endLocal.startOf("day")

    while (cursor <= last) {
      const dateISO = cursor.toISODate()
      if (dateISO) {
        const list = map.get(dateISO) ?? []
        list.push(override)
        map.set(dateISO, list)
      }
      cursor = cursor.plus({ days: 1 })
    }
  }

  return map
}

function buildWindowsByDay(windows: WindowDTO[]) {
  const byDay = new Map<number, Interval[]>()

  for (const window of windows) {
    const list = byDay.get(window.dayOfWeek) ?? []
    list.push({ start: window.startMinute, end: window.endMinute })
    byDay.set(window.dayOfWeek, list)
  }

  for (const [day, list] of byDay.entries()) {
    byDay.set(day, normalizeIntervals(list, { minSize: 1 }))
  }

  return byDay
}

function computeEffectiveIntervalsForDate(args: {
  timeZone: string
  dateISO: string
  weekday: number
  baseByDay: Map<number, Interval[]>
  overridesByDate: Map<string, OverrideDTO[]>
}) {
  const base = args.baseByDay.get(args.weekday) ?? []
  const overrides = args.overridesByDate.get(args.dateISO) ?? []

  const adds: Interval[] = []
  const removes: Interval[] = []

  for (const override of overrides) {
    const local = overrideToLocalIntervalForDate(override, args.dateISO, args.timeZone)
    if (!local) continue
    if (override.kind === "AVAILABLE") adds.push(local)
    else removes.push(local)
  }

  const withAdds = unionIntervals(base, adds, { minSize: 1 })
  const effective = subtractIntervals(withAdds, removes, { minSize: 1 })
  return normalizeIntervals(effective, { minSize: 1 })
}

function isUserAvailableForUtcInterval(args: {
  startAtUtcISO: string
  endAtUtcISO: string
  userId: string
  timeZone: string
  baseByDay: Map<number, Interval[]>
  overridesByDate: Map<string, OverrideDTO[]>
  effectiveCache: Map<string, Interval[]>
}) {
  const startLocal = DateTime.fromISO(args.startAtUtcISO, { zone: "utc" }).setZone(args.timeZone)
  const endLocal = DateTime.fromISO(args.endAtUtcISO, { zone: "utc" }).setZone(args.timeZone)

  const startDate = startLocal.toISODate()
  const endDate = endLocal.toISODate()
  if (!startDate || !endDate || startDate !== endDate) return { ok: false }

  const weekday = startLocal.weekday
  const startMinute = minutesSinceStartOfDay(startLocal)
  const endMinute = minutesSinceStartOfDay(endLocal)

  const cacheKey = `${args.userId}|${startDate}`
  let effective = args.effectiveCache.get(cacheKey)
  if (!effective) {
    effective = computeEffectiveIntervalsForDate({
      timeZone: args.timeZone,
      dateISO: startDate,
      weekday,
      baseByDay: args.baseByDay,
      overridesByDate: args.overridesByDate,
    })
    args.effectiveCache.set(cacheKey, effective)
  }

  const covers = effective.some((interval) => interval.start <= startMinute && interval.end >= endMinute)

  return {
    ok: true as const,
    startMinute,
    endMinute,
    startLocal,
    endLocal,
    covers,
  }
}

export function generateSuggestions(input: GenerateSuggestionsInput): SuggestionCandidate[] {
  const maxCandidates = input.maxCandidates ?? 25

  const preparedAttendees = input.attendees.map((attendee) => ({
    ...attendee,
    baseByDay: buildWindowsByDay(attendee.windows),
    overridesByDate: indexOverridesByLocalDate(attendee.timeZone, attendee.overrides),
    effectiveCache: new Map<string, Interval[]>(),
  }))

  const startDay = DateTime.fromISO(input.rangeStart, { zone: input.timeZone }).startOf("day")
  const endDay = DateTime.fromISO(input.rangeEnd, { zone: input.timeZone }).startOf("day")

  const candidates: Omit<SuggestionCandidate, "rank">[] = []

  let cursor = startDay
  while (cursor <= endDay) {
    const dayEnd = cursor.plus({ minutes: input.dayEndMinute })

    for (let offset = input.dayStartMinute; offset + input.durationMinutes <= input.dayEndMinute; offset += input.stepMinutes) {
      const startLocal = cursor.plus({ minutes: offset })
      const endLocal = startLocal.plus({ minutes: input.durationMinutes })

      if (endLocal > dayEnd) continue
      if (!startLocal.isValid || !endLocal.isValid) continue

      const startAtUtcISO = startLocal.toUTC().toISO()
      const endAtUtcISO = endLocal.toUTC().toISO()
      if (!startAtUtcISO || !endAtUtcISO) continue

      const availableUserIds: string[] = []
      const missingUserIds: string[] = []

      const penalties: Array<{
        userId: string
        penalty: number
        startLocal: DateTime
        endLocal: DateTime
        tz: string
      }> = []

      for (const attendee of preparedAttendees) {
        const result = isUserAvailableForUtcInterval({
          startAtUtcISO,
          endAtUtcISO,
          userId: attendee.userId,
          timeZone: attendee.timeZone,
          baseByDay: attendee.baseByDay,
          overridesByDate: attendee.overridesByDate,
          effectiveCache: attendee.effectiveCache,
        })

        if (!result.ok || !result.covers) {
          missingUserIds.push(attendee.userId)
          continue
        }

        availableUserIds.push(attendee.userId)
        const penalty = penaltyForLocalInterval(result.startMinute, result.endMinute)
        penalties.push({
          userId: attendee.userId,
          penalty,
          startLocal: result.startLocal,
          endLocal: result.endLocal,
          tz: attendee.timeZone,
        })
      }

      const totalAttendees = preparedAttendees.length
      const attendanceRatio = totalAttendees === 0 ? 0 : availableUserIds.length / totalAttendees
      if (attendanceRatio <= 0) continue

      const attendanceScore = clamp01(attendanceRatio)
      const avgPenalty = penalties.length
        ? penalties.reduce((sum, item) => sum + item.penalty, 0) / penalties.length
        : 1
      const maxPenalty = penalties.length
        ? penalties.reduce((max, item) => Math.max(max, item.penalty), 0)
        : 1

      const inconvenienceScore = clamp01(1 - avgPenalty)
      const fairnessScore = clamp01(1 - maxPenalty)
      const totalScore = clamp01(0.6 * attendanceScore + 0.2 * inconvenienceScore + 0.2 * fairnessScore)

      const worst = penalties
        .slice()
        .sort((a, b) => b.penalty - a.penalty)[0]

      const why: string[] = []
      why.push(`${availableUserIds.length}/${totalAttendees} attendees available`)
      why.push(`Attendance score: ${attendanceScore.toFixed(2)}`)
      why.push(`Inconvenience score: ${inconvenienceScore.toFixed(2)}`)
      why.push(`Fairness score: ${fairnessScore.toFixed(2)}`)
      if (worst) {
        why.push(`Worst local time: ${worst.startLocal.toFormat("t")}–${worst.endLocal.toFormat("t")} (${worst.tz})`)
      }

      candidates.push({
        startAt: startAtUtcISO,
        endAt: endAtUtcISO,
        attendanceRatio,
        score: {
          total: totalScore,
          attendance: attendanceScore,
          inconvenience: inconvenienceScore,
          fairness: fairnessScore,
        },
        availableUserIds,
        missingUserIds,
        explanation: {
          why,
          worstLocalTime: worst
            ? {
                userId: worst.userId,
                localStart: worst.startLocal.toISO() ?? "",
                localEnd: worst.endLocal.toISO() ?? "",
                timeZone: worst.tz,
                penalty: worst.penalty,
              }
            : undefined,
        },
      })
    }

    cursor = cursor.plus({ days: 1 })
  }

  const ranked = candidates
    .sort((a, b) => {
      if (b.score.total !== a.score.total) return b.score.total - a.score.total
      if (b.score.attendance !== a.score.attendance) return b.score.attendance - a.score.attendance
      if (b.score.fairness !== a.score.fairness) return b.score.fairness - a.score.fairness
      return a.startAt.localeCompare(b.startAt)
    })
    .slice(0, maxCandidates)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }))

  return ranked
}
