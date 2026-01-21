import { createHash } from "crypto";
import {
  PrismaClient,
  CalendarProvider,
  AvailabilityOverrideKind,
  Role,
} from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_ORG_SLUG = "demo";
const DEMO_ORG_NAME = "Lattice Demo";

type DemoUser = {
  key: "leader" | "memberA" | "memberB";
  email: string;
  name: string;
  role: Role;
  timeZone: string;
};

const DEMO_USERS: DemoUser[] = [
  {
    key: "leader",
    email: "demo.leader@lattice.local",
    name: "Demo Leader",
    role: Role.LEADER,
    timeZone: "America/Los_Angeles",
  },
  {
    key: "memberA",
    email: "demo.member-a@lattice.local",
    name: "Demo Member A",
    role: Role.MEMBER,
    timeZone: "America/New_York",
  },
  {
    key: "memberB",
    email: "demo.member-b@lattice.local",
    name: "Demo Member B",
    role: Role.MEMBER,
    timeZone: "Europe/London",
  },
];

type WindowPattern = { dayOfWeek: number; startMinute: number; endMinute: number };

const AVAILABILITY_WINDOWS: Record<DemoUser["key"], WindowPattern[]> = {
  leader: [
    { dayOfWeek: 1, startMinute: 8 * 60, endMinute: 12 * 60 },
    { dayOfWeek: 1, startMinute: 13 * 60, endMinute: 17 * 60 },
    { dayOfWeek: 2, startMinute: 9 * 60, endMinute: 16 * 60 },
    { dayOfWeek: 4, startMinute: 7 * 60 + 30, endMinute: 15 * 60 },
  ],
  memberA: [
    { dayOfWeek: 1, startMinute: 7 * 60 + 30, endMinute: 11 * 60 },
    { dayOfWeek: 3, startMinute: 12 * 60, endMinute: 18 * 60 },
    { dayOfWeek: 5, startMinute: 8 * 60, endMinute: 14 * 60 },
  ],
  memberB: [
    { dayOfWeek: 2, startMinute: 10 * 60, endMinute: 17 * 60 },
    { dayOfWeek: 4, startMinute: 9 * 60, endMinute: 12 * 60 },
    { dayOfWeek: 5, startMinute: 13 * 60, endMinute: 18 * 60 },
  ],
};

const BUSY_PATTERNS: Record<
  DemoUser["key"],
  Array<{ dayOffset: number; startMinute: number; durationMinutes: number }>
> = {
  leader: [
    { dayOffset: 0, startMinute: 9 * 60, durationMinutes: 75 },
    { dayOffset: 1, startMinute: 11 * 60 + 15, durationMinutes: 45 },
    { dayOffset: 3, startMinute: 15 * 60, durationMinutes: 60 },
  ],
  memberA: [
    { dayOffset: 0, startMinute: 10 * 60, durationMinutes: 60 },
    { dayOffset: 2, startMinute: 13 * 60, durationMinutes: 90 },
    { dayOffset: 4, startMinute: 9 * 60, durationMinutes: 90 },
  ],
  memberB: [
    { dayOffset: 1, startMinute: 8 * 60 + 30, durationMinutes: 60 },
    { dayOffset: 3, startMinute: 12 * 60, durationMinutes: 120 },
    { dayOffset: 4, startMinute: 14 * 60, durationMinutes: 75 },
  ],
};

function getMondayOfCurrentWeek(): Date {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun, 1=Mon ... 6=Sat
  const mondayOffset = utcDay === 0 ? -6 : 1 - utcDay;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(date.getUTCDate() + days);
  return next;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function computeBlockHash({
  orgId,
  userId,
  sourceHash,
  start,
  end,
}: {
  orgId: string;
  userId: string;
  sourceHash: string;
  start: Date;
  end: Date;
}) {
  return createHash("sha256")
    .update(`${orgId}|${userId}|${sourceHash}|${start.toISOString()}|${end.toISOString()}`)
    .digest("hex");
}

function buildBusyBlockArgs({
  orgId,
  userId,
  pattern,
  patternIndex,
}: {
  orgId: string;
  userId: string;
  pattern: { dayOffset: number; startMinute: number; durationMinutes: number };
  patternIndex: number;
}) {
  const weekStart = getMondayOfCurrentWeek();
  const dayStart = addDays(weekStart, pattern.dayOffset);
  const start = addMinutes(dayStart, pattern.startMinute);
  const end = addMinutes(start, pattern.durationMinutes);
  const sourceHash = `demo:${userId}:${patternIndex}`;
  return {
    orgId,
    userId,
    provider: CalendarProvider.GOOGLE,
    sourceHash,
    startUtc: start,
    endUtc: end,
    blockHash: computeBlockHash({
      orgId,
      userId,
      sourceHash,
      start,
      end,
    }),
    createdAt: start,
  };
}

function buildSuggestionCandidate({
  rank,
  start,
  end,
  availableUserIds,
  missingUserIds,
}: {
  rank: number;
  start: Date;
  end: Date;
  availableUserIds: string[];
  missingUserIds: string[];
}) {
  return {
    rank,
    startAt: start,
    endAt: end,
    attendanceRatio: availableUserIds.length / (availableUserIds.length + missingUserIds.length),
    scoreTotal: 92 - rank,
    scoreAttendance: 100 - rank * 2,
    scoreInconvenience: 75 - rank,
    scoreFairness: 60 - rank,
    availableUserIds,
    missingUserIds,
    explanation: {
      note: "Seeded demo candidate",
    },
  };
}

async function main() {
  const org = await prisma.org.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: { name: DEMO_ORG_NAME },
    create: { name: DEMO_ORG_NAME, slug: DEMO_ORG_SLUG },
  });

  await Promise.all([
    prisma.membership.deleteMany({ where: { orgId: org.id } }),
    prisma.availabilityTemplate.deleteMany({ where: { orgId: org.id } }),
    prisma.availabilityOverride.deleteMany({ where: { orgId: org.id } }),
    prisma.busyBlock.deleteMany({ where: { orgId: org.id } }),
    prisma.suggestionRequest.deleteMany({ where: { orgId: org.id } }),
  ]);

  const createdUsers = {} as Record<
    DemoUser["key"],
    Awaited<ReturnType<typeof prisma.user.upsert>>
  >;

  for (const user of DEMO_USERS) {
    const created = await prisma.user.upsert({
      where: { email: user.email },
      create: { email: user.email, name: user.name },
      update: { name: user.name },
    });
    createdUsers[user.key] = created;
  }

  for (const user of DEMO_USERS) {
    await prisma.membership.create({
      data: {
        orgId: org.id,
        userId: createdUsers[user.key]!.id,
        role: user.role,
      },
    });

    const windows = AVAILABILITY_WINDOWS[user.key].map((window) => ({
      dayOfWeek: window.dayOfWeek,
      startMinute: window.startMinute,
      endMinute: window.endMinute,
    }));

    await prisma.availabilityTemplate.create({
      data: {
        orgId: org.id,
        userId: createdUsers[user.key]!.id,
        timeZone: user.timeZone,
        windows: {
          create: windows,
        },
      },
    });
  }

  const overrideStart = addMinutes(addDays(getMondayOfCurrentWeek(), 2), 11 * 60);
  const overrideEnd = addMinutes(overrideStart, 90);
  await prisma.availabilityOverride.create({
    data: {
      orgId: org.id,
      userId: createdUsers.leader!.id,
      kind: AvailabilityOverrideKind.UNAVAILABLE,
      note: "Demo retro-planning block",
      startAt: overrideStart,
      endAt: overrideEnd,
    },
  });

  for (const user of DEMO_USERS) {
    const patterns = BUSY_PATTERNS[user.key];
    for (const [index, pattern] of patterns.entries()) {
      await prisma.busyBlock.create({
        data: buildBusyBlockArgs({
          orgId: org.id,
          userId: createdUsers[user.key]!.id,
          pattern,
          patternIndex: index,
        }),
      });
    }
  }

  const monday = getMondayOfCurrentWeek();
  const requestStart = addDays(monday, 1);
  const requestEnd = addDays(requestStart, 4);
  const requestKey = "demo-weekly-request";

  const candidateBaseTimes = [
    {
      dayOffset: 0,
      startMinute: 13 * 60,
      durationMinutes: 60,
      attendees: [createdUsers.leader!.id, createdUsers.memberA!.id],
      missing: [createdUsers.memberB!.id],
    },
    {
      dayOffset: 1,
      startMinute: 10 * 60 + 30,
      durationMinutes: 60,
      attendees: [createdUsers.leader!.id, createdUsers.memberB!.id],
      missing: [createdUsers.memberA!.id],
    },
    {
      dayOffset: 3,
      startMinute: 15 * 60,
      durationMinutes: 90,
      attendees: [
        createdUsers.leader!.id,
        createdUsers.memberA!.id,
        createdUsers.memberB!.id,
      ],
      missing: [],
    },
  ];

  const candidates = candidateBaseTimes.map((candidate, index) =>
    buildSuggestionCandidate({
      rank: index + 1,
      start: addMinutes(addDays(requestStart, candidate.dayOffset), candidate.startMinute),
      end: addMinutes(
        addMinutes(addDays(requestStart, candidate.dayOffset), candidate.startMinute),
        candidate.durationMinutes,
      ),
      availableUserIds: candidate.attendees,
      missingUserIds: candidate.missing,
    }),
  );

  await prisma.suggestionRequest.create({
    data: {
      orgId: org.id,
      createdById: createdUsers.leader!.id,
      requestKey,
      title: "Demo weekly sync",
      timeZone: "America/Los_Angeles",
      rangeStart: requestStart,
      rangeEnd: requestEnd,
      durationMinutes: 60,
      stepMinutes: 15,
      dayStartMinute: 8 * 60,
      dayEndMinute: 20 * 60,
      dataFingerprint: createHash("sha256")
        .update(`${org.id}:${requestKey}`)
        .digest("hex"),
      attendees: {
        createMany: {
          data: DEMO_USERS.map((user) => ({ userId: createdUsers[user.key]!.id })),
        },
      },
      candidates: {
        createMany: {
          data: candidates,
        },
      },
    },
  });

  console.info("Demo data seeded.");
}

main()
  .catch((error) => {
    console.error("Failed to seed demo data:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
