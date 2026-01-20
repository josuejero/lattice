-- CreateEnum
CREATE TYPE "AvailabilityOverrideKind" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateTable
CREATE TABLE "AvailabilityTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityWindow" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "AvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityOverride" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "kind" "AvailabilityOverrideKind" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AvailabilityTemplate_orgId_idx" ON "AvailabilityTemplate"("orgId");

-- CreateIndex
CREATE INDEX "AvailabilityTemplate_userId_idx" ON "AvailabilityTemplate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AvailabilityTemplate_orgId_userId_key" ON "AvailabilityTemplate"("orgId", "userId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_templateId_idx" ON "AvailabilityWindow"("templateId");

-- CreateIndex
CREATE INDEX "AvailabilityWindow_dayOfWeek_idx" ON "AvailabilityWindow"("dayOfWeek");

-- CreateIndex
CREATE INDEX "AvailabilityOverride_orgId_startAt_idx" ON "AvailabilityOverride"("orgId", "startAt");

-- CreateIndex
CREATE INDEX "AvailabilityOverride_userId_startAt_idx" ON "AvailabilityOverride"("userId", "startAt");

-- CreateIndex
CREATE INDEX "AvailabilityOverride_orgId_userId_startAt_idx" ON "AvailabilityOverride"("orgId", "userId", "startAt");

-- AddForeignKey
ALTER TABLE "AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityTemplate" ADD CONSTRAINT "AvailabilityTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityWindow" ADD CONSTRAINT "AvailabilityWindow_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "AvailabilityTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityOverride" ADD CONSTRAINT "AvailabilityOverride_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityOverride" ADD CONSTRAINT "AvailabilityOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
