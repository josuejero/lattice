import { prisma } from "@lattice/db";

export const AuditActions = {
  ORG_CREATED: "ORG_CREATED",
  MEMBER_INVITED: "MEMBER_INVITED",
  MEMBER_ROLE_UPDATED: "MEMBER_ROLE_UPDATED",
  MEMBER_REMOVED: "MEMBER_REMOVED",
  AVAILABILITY_TEMPLATE_UPDATED: "AVAILABILITY_TEMPLATE_UPDATED",
  AVAILABILITY_OVERRIDE_CREATED: "AVAILABILITY_OVERRIDE_CREATED",
  AVAILABILITY_OVERRIDE_DELETED: "AVAILABILITY_OVERRIDE_DELETED",
  CALENDAR_CONNECTED: "CALENDAR_CONNECTED",
  CALENDAR_DISCONNECTED: "CALENDAR_DISCONNECTED",
  CALENDAR_SYNC_STARTED: "CALENDAR_SYNC_STARTED",
  CALENDAR_SYNC_SUCCESS: "CALENDAR_SYNC_SUCCESS",
  CALENDAR_SYNC_FAILURE: "CALENDAR_SYNC_FAILURE",
  SUGGESTION_REQUEST_CREATED: "SUGGESTION_REQUEST_CREATED",
  SLOT_CONFIRMED: "SLOT_CONFIRMED",
  WRITEBACK_ATTEMPTED: "WRITEBACK_ATTEMPTED",
  ACCEPTANCE_CHECK: "ACCEPTANCE_CHECK",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export type LogAuditOptions = {
  orgId: string;
  actorUserId?: string | null;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
};

export async function logAudit(options: LogAuditOptions) {
  try {
    await prisma.auditLog.create({
      data: {
        orgId: options.orgId,
        actorUserId: options.actorUserId ?? undefined,
        action: options.action,
        targetType: options.targetType ?? undefined,
        targetId: options.targetId ?? undefined,
        metadata: options.metadata ?? undefined,
      },
    });
  } catch (error) {
    console.warn("[audit] failed to record event", error);
  }
}
