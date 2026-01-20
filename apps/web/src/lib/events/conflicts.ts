export type ConflictInterval = {
  userId: string;
  start: Date;
  end: Date;
};

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
) {
  return aStart < bEnd && aEnd > bStart;
}

export function findConflictingUserIds({
  intervalStart,
  intervalEnd,
  intervals,
}: {
  intervalStart: Date;
  intervalEnd: Date;
  intervals: ConflictInterval[];
}) {
  const seen = new Set<string>();
  for (const interval of intervals) {
    if (intervalsOverlap(intervalStart, intervalEnd, interval.start, interval.end)) {
      seen.add(interval.userId);
    }
  }
  return [...seen].sort();
}
