-- Drop this file and rerun `pnpm prisma migrate dev` if the schema drift deviates.
-- Added Phase 5 idempotency tracking.
ALTER TABLE "SuggestionRequest"
ADD COLUMN "dataFingerprint" TEXT;

CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER,
    "responseBody" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "expiresAt" TIMESTAMPTZ NOT NULL,
    PRIMARY KEY ("id")
);

ALTER TABLE "IdempotencyKey"
ADD CONSTRAINT "IdempotencyKey_orgId_fkey"
FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "IdempotencyKey_orgId_endpoint_key_key" ON "IdempotencyKey"("orgId","endpoint","key");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");
