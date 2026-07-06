import { DateTime } from "luxon"

import type {
  AttendeeAvailabilityInput,
  OverrideDTO,
  WindowDTO,
} from "../suggestions/engine"
import type { MemberTag } from "./event-archetypes"

export type PersonaKey =
  | "nine_to_five"
  | "retail_service"
  | "student"
  | "parent_caretaker"
  | "remote_worker"
  | "night_shift"
  | "weekends_only"
  | "high_availability_organizer"
  | "low_availability_member"

export type MockMember = AttendeeAvailabilityInput & {
  email: string
  name: string
  persona: PersonaKey
  tags: MemberTag[]
}

export type MockOrg = {
  id: string
  name: string
  timeZone: string
  monthStart: string
  monthEnd: string
  seed: number
  members: MockMember[]
}

type PersonaConfig = {
  key: PersonaKey
  weight: number
  baseTags: MemberTag[]
  windows: WindowDTO[]
  overrideDaysPerMonth: [number, number]
}

const h = (hour: number, minute = 0) => hour * 60 + minute

const weekday = (startMinute: number, endMinute: number): WindowDTO[] =>
  [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }))

const PERSONAS: PersonaConfig[] = [
  {
    key: "nine_to_five",
    weight: 15,
    baseTags: ["weekday_evening", "broad_member"],
    windows: [
      ...[1, 2, 3, 4].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: h(18),
        endMinute: h(21),
      })),
      { dayOfWeek: 6, startMinute: h(10), endMinute: h(16) },
    ],
    overrideDaysPerMonth: [3, 7],
  },
  {
    key: "retail_service",
    weight: 9,
    baseTags: ["broad_member"],
    windows: [
      { dayOfWeek: 1, startMinute: h(10), endMinute: h(15) },
      { dayOfWeek: 2, startMinute: h(19), endMinute: h(21) },
      { dayOfWeek: 4, startMinute: h(10), endMinute: h(15) },
      { dayOfWeek: 7, startMinute: h(12), endMinute: h(18) },
    ],
    overrideDaysPerMonth: [6, 11],
  },
  {
    key: "student",
    weight: 6,
    baseTags: ["weekday_evening", "political_education", "study_group"],
    windows: [
      ...[1, 2, 3, 4].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: h(17),
        endMinute: h(22),
      })),
      { dayOfWeek: 6, startMinute: h(12), endMinute: h(18) },
      { dayOfWeek: 7, startMinute: h(12), endMinute: h(18) },
    ],
    overrideDaysPerMonth: [4, 8],
  },
  {
    key: "parent_caretaker",
    weight: 5,
    baseTags: ["broad_member"],
    windows: [
      ...[1, 2, 3, 4].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: h(19),
        endMinute: h(21),
      })),
      { dayOfWeek: 6, startMinute: h(10), endMinute: h(14) },
    ],
    overrideDaysPerMonth: [6, 10],
  },
  {
    key: "remote_worker",
    weight: 5,
    baseTags: ["weekday_evening", "broad_member"],
    windows: [
      ...weekday(h(12), h(14)),
      ...[1, 2, 3, 4].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: h(18),
        endMinute: h(21),
      })),
      { dayOfWeek: 7, startMinute: h(11), endMinute: h(15) },
    ],
    overrideDaysPerMonth: [3, 6],
  },
  {
    key: "night_shift",
    weight: 3,
    baseTags: ["broad_member"],
    windows: [
      ...[1, 3, 5].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: h(12),
        endMinute: h(16),
      })),
      { dayOfWeek: 6, startMinute: h(13), endMinute: h(18) },
    ],
    overrideDaysPerMonth: [5, 9],
  },
  {
    key: "weekends_only",
    weight: 4,
    baseTags: ["weekend_day", "broad_member"],
    windows: [
      { dayOfWeek: 6, startMinute: h(10), endMinute: h(18) },
      { dayOfWeek: 7, startMinute: h(10), endMinute: h(18) },
    ],
    overrideDaysPerMonth: [2, 5],
  },
  {
    key: "high_availability_organizer",
    weight: 2,
    baseTags: ["leader", "weekday_evening", "weekend_day", "broad_member"],
    windows: [
      ...[1, 2, 3, 4, 5].map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: h(17),
        endMinute: h(21),
      })),
      { dayOfWeek: 6, startMinute: h(9), endMinute: h(18) },
      { dayOfWeek: 7, startMinute: h(10), endMinute: h(18) },
    ],
    overrideDaysPerMonth: [3, 6],
  },
  {
    key: "low_availability_member",
    weight: 1,
    baseTags: ["broad_member"],
    windows: [
      { dayOfWeek: 3, startMinute: h(18), endMinute: h(20) },
      { dayOfWeek: 7, startMinute: h(13), endMinute: h(16) },
    ],
    overrideDaysPerMonth: [2, 4],
  },
]

const COMMITTEE_TAGS: MemberTag[] = [
  "electoral",
  "labor",
  "trans_rights",
  "political_education",
  "membership",
]

const BRANCH_TAGS: MemberTag[] = [
  "branch_springfield",
  "branch_franklin",
  "branch_northampton",
  "branch_amherst",
]

function makeRng(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

function intBetween(rand: () => number, min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}

function pickWeighted<T extends { weight: number }>(rand: () => number, items: T[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0)
  let roll = rand() * total
  for (const item of items) {
    roll -= item.weight
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

function pickOne<T>(rand: () => number, items: T[]) {
  return items[Math.floor(rand() * items.length)]
}

function maybe(rand: () => number, probability: number) {
  return rand() < probability
}

function unique<T>(items: T[]) {
  return [...new Set(items)]
}

function jitterWindows(rand: () => number, windows: WindowDTO[]): WindowDTO[] {
  return windows.map((window) => {
    const startJitter = 15 * intBetween(rand, -2, 2)
    const endJitter = 15 * intBetween(rand, -1, 2)
    const startMinute = Math.max(0, Math.min(1440, window.startMinute + startJitter))
    const endMinute = Math.max(startMinute + 60, Math.min(1440, window.endMinute + endJitter))
    return { ...window, startMinute, endMinute }
  })
}

function localIntervalToUtcOverride(args: {
  dateISO: string
  timeZone: string
  startMinute: number
  durationMinutes: number
}): OverrideDTO {
  const start = DateTime.fromISO(args.dateISO, { zone: args.timeZone })
    .startOf("day")
    .plus({ minutes: args.startMinute })
  const end = start.plus({ minutes: args.durationMinutes })

  return {
    startAt: start.toUTC().toISO() ?? start.toJSDate().toISOString(),
    endAt: end.toUTC().toISO() ?? end.toJSDate().toISOString(),
    kind: "UNAVAILABLE",
  }
}

function makeMonthlyOverrides(args: {
  rand: () => number
  monthStart: string
  monthEnd: string
  timeZone: string
  countRange: [number, number]
}) {
  const start = DateTime.fromISO(args.monthStart, { zone: args.timeZone }).startOf("day")
  const end = DateTime.fromISO(args.monthEnd, { zone: args.timeZone }).startOf("day")
  const days = Math.max(1, Math.floor(end.diff(start, "days").days) + 1)
  const count = intBetween(args.rand, args.countRange[0], args.countRange[1])
  const overrides: OverrideDTO[] = []

  for (let i = 0; i < count; i += 1) {
    const day = start.plus({ days: intBetween(args.rand, 0, days - 1) })
    const dateISO = day.toISODate()
    if (!dateISO) continue

    const startMinute = pickOne(args.rand, [
      h(8),
      h(9),
      h(12),
      h(13),
      h(17),
      h(18),
      h(19),
    ])
    const durationMinutes = pickOne(args.rand, [60, 90, 120, 180])

    overrides.push(
      localIntervalToUtcOverride({
        dateISO,
        timeZone: args.timeZone,
        startMinute,
        durationMinutes,
      }),
    )
  }

  return overrides
}

function makeTags(rand: () => number, persona: PersonaConfig, index: number): MemberTag[] {
  const tags: MemberTag[] = [...persona.baseTags]

  if (index === 0) tags.push("leader")
  if (index < 7) tags.push("new_member")

  tags.push(pickOne(rand, BRANCH_TAGS))

  if (maybe(rand, 0.32)) tags.push(pickOne(rand, COMMITTEE_TAGS))
  if (maybe(rand, 0.26)) tags.push("canvass")
  if (maybe(rand, 0.18)) tags.push("phonebank")
  if (maybe(rand, 0.2)) tags.push("study_group")
  if (maybe(rand, 0.22)) tags.push("social")

  return unique(tags)
}

export function generateMockOrg(options?: {
  seed?: number
  memberCount?: number
  monthStart?: string
  monthEnd?: string
  timeZone?: string
}): MockOrg {
  const seed = options?.seed ?? 20260705
  const memberCount = options?.memberCount ?? 50
  const timeZone = options?.timeZone ?? "America/New_York"
  const monthStart = options?.monthStart ?? "2026-08-01"
  const monthEnd = options?.monthEnd ?? "2026-08-31"

  const rand = makeRng(seed)

  const members: MockMember[] = Array.from({ length: memberCount }, (_, i) => {
    const persona = pickWeighted(rand, PERSONAS)
    const tags = makeTags(rand, persona, i)

    return {
      userId: `mock-user-${String(i + 1).padStart(2, "0")}`,
      email: `mock.user.${String(i + 1).padStart(2, "0")}@lattice.local`,
      name: `Mock User ${String(i + 1).padStart(2, "0")}`,
      persona: persona.key,
      tags,
      timeZone,
      windows: jitterWindows(rand, persona.windows),
      overrides: makeMonthlyOverrides({
        rand,
        monthStart,
        monthEnd,
        timeZone,
        countRange: persona.overrideDaysPerMonth,
      }),
    }
  })

  return {
    id: "mock-rvdsa",
    name: "Mock RVDSA",
    timeZone,
    monthStart,
    monthEnd,
    seed,
    members,
  }
}
