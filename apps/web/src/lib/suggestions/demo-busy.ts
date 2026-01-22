import { createHash } from "crypto";
import { DateTime } from "luxon";

const WEEK_SPREAD = 2;
const MAX_SHIFT_MINUTES = 40;
const EARLIEST_MINUTE = 6 * 60;
const LATEST_MINUTE = 21 * 60;

const BASE_PATTERNS: Array<{ dayOffset: number; baseStartMinute: number; durationMinutes: number }> = [
  { dayOffset: 0, baseStartMinute: 9 * 60, durationMinutes: 90 },
  { dayOffset: 1, baseStartMinute: 11 * 60 + 15, durationMinutes: 60 },
  { dayOffset: 2, baseStartMinute: 14 * 60, durationMinutes: 75 },
  { dayOffset: 3, baseStartMinute: 8 * 60 + 30, durationMinutes: 120 },
  { dayOffset: 4, baseStartMinute: 13 * 60 + 30, durationMinutes: 60 },
];

type DemoBusyBlock = {
  userId: string;
  startUtc: Date;
  endUtc: Date;
  createdAt: Date;
};

function clampStartMinute(base: number, duration: number): number {
  const maxStart = Math.max(EARLIEST_MINUTE, LATEST_MINUTE - duration);
  return Math.min(Math.max(base, EARLIEST_MINUTE), maxStart);
}

function mondayOf(date: DateTime) {
  return date.minus({ days: date.weekday - 1 }).startOf("day");
}

export function generateDemoBusyBlocks(params: {
  userId: string | null;
  rangeStart: Date;
  rangeEnd: Date;
}): DemoBusyBlock[] {
  const userId = params.userId;
  if (userId === null) {
    return [];
  }

  const safeUserId = userId!;
  const rangeStartDt = DateTime.fromJSDate(params.rangeStart, { zone: "utc" });
  const rangeEndDt = DateTime.fromJSDate(params.rangeEnd, { zone: "utc" });
  const baseWeek = mondayOf(DateTime.utc());
  const blocks: DemoBusyBlock[] = [];

  for (let weekOffset = 0; weekOffset < WEEK_SPREAD; weekOffset += 1) {
    const weekStart = baseWeek.plus({ weeks: weekOffset });
    for (const pattern of BASE_PATTERNS) {
      const weekKey = weekStart.toISODate();
      const digest = createHash("sha256")
        .update(`${safeUserId}:${weekKey}:${pattern.dayOffset}`)
        .digest("hex");
      const raw = parseInt(digest.slice(0, 4), 16);
      const range = MAX_SHIFT_MINUTES * 2 + 1;
      const shift = (raw % range) - MAX_SHIFT_MINUTES;
      const adjustedStart = clampStartMinute(pattern.baseStartMinute + shift, pattern.durationMinutes);
      const dayStart = weekStart.plus({ days: pattern.dayOffset, minutes: adjustedStart });
      const dayEnd = dayStart.plus({ minutes: pattern.durationMinutes });

      if (dayEnd <= rangeStartDt || dayStart >= rangeEndDt) continue;

      blocks.push({
        userId: safeUserId,
        startUtc: dayStart.toJSDate(),
        endUtc: dayEnd.toJSDate(),
        createdAt: dayStart.toJSDate(),
      });
    }
  }

  return blocks;
}
