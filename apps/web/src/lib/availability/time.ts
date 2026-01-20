import { DateTime } from "luxon"
import type { Interval } from "./intervals"

export function minutesFromTimeString(t: string): number {
  const [hh, mm] = t.split(":").map((x) => Number(x))
  const h = Number.isFinite(hh) ? hh : 0
  const m = Number.isFinite(mm) ? mm : 0
  return h * 60 + m
}

export function parseHHMM(hhmm: string) {
  const [hourRaw, minuteRaw] = hhmm.split(":")
  if (!hourRaw || !minuteRaw) {
    throw new Error(`Invalid time: ${hhmm}`)
  }

  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)

  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error(`Invalid time: ${hhmm}`)
  }

  return hour * 60 + minute
}

export function timeStringFromMinutes(mins: number): string {
  const m = Math.max(0, Math.min(1439, Math.trunc(mins)))
  const hh = String(Math.floor(m / 60)).padStart(2, "0")
  const mm = String(m % 60).padStart(2, "0")
  return `${hh}:${mm}`
}

export function toUtcIsoFromLocal(
  dateISO: string,
  timeHHMM: string,
  timeZone: string,
): string {
  const [hh, mm] = timeHHMM.split(":").map((x) => Number(x))
  const dt = DateTime.fromISO(dateISO, { zone: timeZone }).set({
    hour: hh || 0,
    minute: mm || 0,
    second: 0,
    millisecond: 0,
  })
  return dt.toUTC().toISO()!
}

export function overrideToLocalIntervalForDate(
  override: { startAt: string; endAt: string },
  dateISO: string,
  timeZone: string,
): Interval | null {
  const dayStart = DateTime.fromISO(dateISO, { zone: timeZone }).startOf("day")
  const dayEnd = dayStart.plus({ days: 1 })

  const start = DateTime.fromISO(override.startAt, { zone: "utc" }).setZone(timeZone)
  const end = DateTime.fromISO(override.endAt, { zone: "utc" }).setZone(timeZone)

  const s = start < dayStart ? dayStart : start
  const e = end > dayEnd ? dayEnd : end

  if (e <= s) return null

  return {
    start: Math.floor(s.diff(dayStart, "minutes").minutes),
    end: Math.ceil(e.diff(dayStart, "minutes").minutes),
  }
}
