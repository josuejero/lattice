import { createHash } from "crypto";

import { prisma } from "@lattice/db";
import type {
  AvailabilityTemplate,
  AvailabilityWindow,
  AvailabilityOverride,
  BusyBlock,
} from "@prisma/client";
import { generateDemoBusyBlocks } from "./demo-busy";

type TemplateWithWindows = AvailabilityTemplate & {
  windows: AvailabilityWindow[];
};

export type SuggestionAvailabilityState = {
  templates: TemplateWithWindows[];
  overrides: AvailabilityOverride[];
  busyBlocks: Array<Pick<BusyBlock, "userId" | "startUtc" | "endUtc" | "createdAt">>;
  dataFingerprint: string;
};

export async function loadSuggestionAvailabilityState(params: {
  orgId: string;
  attendeeUserIds: string[];
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<SuggestionAvailabilityState> {
  const [templates, overrides, busyBlocks, calendarConnections] = await Promise.all([
    prisma.availabilityTemplate.findMany({
      where: {
        orgId: params.orgId,
        userId: { in: params.attendeeUserIds },
      },
      include: { windows: true },
    }),
    prisma.availabilityOverride.findMany({
      where: {
        orgId: params.orgId,
        userId: { in: params.attendeeUserIds },
        startAt: { lt: params.rangeEnd },
        endAt: { gt: params.rangeStart },
      },
      orderBy: { startAt: "asc" },
    }),
    prisma.busyBlock.findMany({
      where: {
        orgId: params.orgId,
        userId: { in: params.attendeeUserIds },
        provider: "GOOGLE",
        startUtc: { lt: params.rangeEnd },
        endUtc: { gt: params.rangeStart },
      },
      orderBy: { startUtc: "asc" },
      select: { userId: true, startUtc: true, endUtc: true, createdAt: true },
    }),
    prisma.calendarConnection.findMany({
      where: {
        userId: { in: params.attendeeUserIds },
        provider: "GOOGLE",
        status: "ACTIVE",
      },
      select: { userId: true },
    }),
  ]);

  const availabilityVersionByUser = buildAvailabilityVersionMap(templates, overrides);
  const fallbackBlocks = buildDemoFallbackBlocks(params, busyBlocks, calendarConnections);
  const allBusyBlocks = [...busyBlocks, ...fallbackBlocks].sort(
    (a, b) => a.startUtc.getTime() - b.startUtc.getTime(),
  );
  const busyVersionByUser = buildBusyVersionMap(allBusyBlocks);
  const dataFingerprint = computeDataFingerprint(
    params.attendeeUserIds,
    availabilityVersionByUser,
    busyVersionByUser,
  );

  return {
    templates,
    overrides,
    busyBlocks: allBusyBlocks,
    dataFingerprint,
  };
}

function buildAvailabilityVersionMap(
  templates: TemplateWithWindows[],
  overrides: AvailabilityOverride[],
) {
  const map = new Map<string, Date>();
  for (const template of templates) {
    const existing = map.get(template.userId);
    if (!existing || template.updatedAt > existing) {
      map.set(template.userId, template.updatedAt);
    }
  }
  for (const override of overrides) {
    const existing = map.get(override.userId);
    if (!existing || override.updatedAt > existing) {
      map.set(override.userId, override.updatedAt);
    }
  }
  return map;
}

function buildBusyVersionMap(busyBlocks: Array<Pick<BusyBlock, "userId" | "createdAt">>) {
  const map = new Map<string, Date>();
  for (const block of busyBlocks) {
    const existing = map.get(block.userId);
    if (!existing || block.createdAt > existing) {
      map.set(block.userId, block.createdAt);
    }
  }
  return map;
}

function computeDataFingerprint(
  attendeeUserIds: string[],
  availabilityVersionByUser: Map<string, Date>,
  busyVersionByUser: Map<string, Date>,
) {
  const segments = attendeeUserIds.map((userId) => {
    const availability = availabilityVersionByUser.get(userId);
    const busy = busyVersionByUser.get(userId);
    return `${userId}:${availability?.toISOString() ?? "none"}:${busy?.toISOString() ?? "none"}`;
  });
  return createHash("sha256").update(segments.join("|")).digest("hex");
}

function buildDemoFallbackBlocks(
  params: Parameters<typeof loadSuggestionAvailabilityState>[0],
  existingBusyBlocks: Array<Pick<BusyBlock, "userId" | "startUtc" | "endUtc" | "createdAt">>,
  calendarConnections: Array<{ userId: string }>,
): Array<Pick<BusyBlock, "userId" | "startUtc" | "endUtc" | "createdAt">> {
  const connectedUsers = new Set(calendarConnections.map((connection) => connection.userId));
  const usersWithBusy = new Set(existingBusyBlocks.map((block) => block.userId));

  return params.attendeeUserIds.flatMap((userId) => {
    if (connectedUsers.has(userId) || usersWithBusy.has(userId)) {
      return [];
    }
    return generateDemoBusyBlocks({
      userId,
      rangeStart: params.rangeStart,
      rangeEnd: params.rangeEnd,
    });
  });
}
