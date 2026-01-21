-- Added Phase 6A audit logging.
CREATE TYPE "AuditAction" AS ENUM (
    'ORG_CREATED',
    'MEMBER_INVITED',
    'MEMBER_ROLE_UPDATED',
    'MEMBER_REMOVED',
    'AVAILABILITY_TEMPLATE_UPDATED',
    'AVAILABILITY_OVERRIDE_CREATED',
    'AVAILABILITY_OVERRIDE_DELETED',
    'CALENDAR_CONNECTED',
    'CALENDAR_DISCONNECTED',
    'CALENDAR_SYNC_STARTED',
    'CALENDAR_SYNC_SUCCESS',
    'CALENDAR_SYNC_FAILURE',
    'SUGGESTION_REQUEST_CREATED',
    'SLOT_CONFIRMED',
    'WRITEBACK_ATTEMPTED',
    'ACCEPTANCE_CHECK'
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_orgId_createdAt_idx" ON "AuditLog"("orgId","createdAt");
CREATE INDEX "AuditLog_orgId_action_createdAt_idx" ON "AuditLog"("orgId","action","createdAt");

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
ADD CONSTRAINT "AuditLog_actorUserId_fkey"
FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
