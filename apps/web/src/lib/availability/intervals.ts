export type Interval = { start: number; end: number } // minutes from midnight

export function clampMinute(n: number): number {
  if (Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1440, Math.trunc(n)))
}

export function normalizeIntervals(
  intervals: Interval[],
  { minSize = 15 }: { minSize?: number } = {},
): Interval[] {
  const cleaned = intervals
    .map((i) => ({ start: clampMinute(i.start), end: clampMinute(i.end) }))
    .filter((i) => i.start < i.end)
    .filter((i) => i.end - i.start >= minSize)
    .sort((a, b) => a.start - b.start)

  const merged: Interval[] = []
  for (const cur of cleaned) {
    const last = merged[merged.length - 1]
    if (!last || cur.start > last.end) merged.push({ ...cur })
    else last.end = Math.max(last.end, cur.end)
  }
  return merged
}

export function unionIntervals(
  base: Interval[],
  add: Interval[],
  options?: { minSize?: number },
): Interval[] {
  return normalizeIntervals([...base, ...add], options)
}

// Subtract remove[] from base[]
export function subtractIntervals(
  base: Interval[],
  remove: Interval[],
  options?: { minSize?: number },
): Interval[] {
  const b = normalizeIntervals(base, options)
  const r = normalizeIntervals(remove, options)
  if (r.length === 0) return b

  const out: Interval[] = []

  for (const bi of b) {
    let fragments: Interval[] = [bi]

    for (const ri of r) {
      const next: Interval[] = []
      for (const f of fragments) {
        // no overlap
        if (ri.end <= f.start || ri.start >= f.end) {
          next.push(f)
          continue
        }
        // overlap: split
        if (ri.start > f.start) next.push({ start: f.start, end: ri.start })
        if (ri.end < f.end) next.push({ start: ri.end, end: f.end })
      }
      fragments = next
      if (fragments.length === 0) break
    }

    out.push(...fragments)
  }

  return normalizeIntervals(out, options)
}
