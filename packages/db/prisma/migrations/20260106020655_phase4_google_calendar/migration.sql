-- CreateEnum
CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "CalendarConnectionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'ERROR');

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "scopes" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "status" "CalendarConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSelection" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "calendarIdHash" TEXT NOT NULL,
    "isBusySource" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusyBlock" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "startUtc" TIMESTAMP(3) NOT NULL,
    "endUtc" TIMESTAMP(3) NOT NULL,
    "blockHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarSyncRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "provider" "CalendarProvider" NOT NULL,
    "rangeStartUtc" TIMESTAMP(3) NOT NULL,
    "rangeEndUtc" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorDetail" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionRequest" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "title" TEXT,
    "timeZone" TEXT NOT NULL,
    "rangeStart" TIMESTAMP(3) NOT NULL,
    "rangeEnd" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "stepMinutes" INTEGER NOT NULL DEFAULT 15,
    "dayStartMinute" INTEGER NOT NULL DEFAULT 480,
    "dayEndMinute" INTEGER NOT NULL DEFAULT 1200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuggestionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionRequestAttendee" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "SuggestionRequestAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestionCandidate" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "attendanceRatio" DOUBLE PRECISION NOT NULL,
    "scoreTotal" DOUBLE PRECISION NOT NULL,
    "scoreAttendance" DOUBLE PRECISION NOT NULL,
    "scoreInconvenience" DOUBLE PRECISION NOT NULL,
    "scoreFairness" DOUBLE PRECISION NOT NULL,
    "availableUserIds" TEXT[],
    "missingUserIds" TEXT[],
    "explanation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_provider_key" ON "CalendarConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSelection_connectionId_orgId_calendarIdHash_key" ON "CalendarSelection"("connectionId", "orgId", "calendarIdHash");

-- CreateIndex
CREATE UNIQUE INDEX "BusyBlock_blockHash_key" ON "BusyBlock"("blockHash");

-- CreateIndex
CREATE INDEX "BusyBlock_orgId_userId_startUtc_idx" ON "BusyBlock"("orgId", "userId", "startUtc");

-- CreateIndex
CREATE INDEX "CalendarSyncRun_orgId_userId_startedAt_idx" ON "CalendarSyncRun"("orgId", "userId", "startedAt");

-- CreateIndex
CREATE INDEX "SuggestionRequest_orgId_createdAt_idx" ON "SuggestionRequest"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionRequest_orgId_requestKey_key" ON "SuggestionRequest"("orgId", "requestKey");

-- CreateIndex
CREATE INDEX "SuggestionRequestAttendee_userId_idx" ON "SuggestionRequestAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestionRequestAttendee_requestId_userId_key" ON "SuggestionRequestAttendee"("requestId", "userId");

-- CreateIndex
CREATE INDEX "SuggestionCandidate_requestId_rank_idx" ON "SuggestionCandidate"("requestId", "rank");

-- CreateIndex
CREATE INDEX "SuggestionCandidate_startAt_idx" ON "SuggestionCandidate"("startAt");

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSelection" ADD CONSTRAINT "CalendarSelection_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSelection" ADD CONSTRAINT "CalendarSelection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusyBlock" ADD CONSTRAINT "BusyBlock_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusyBlock" ADD CONSTRAINT "BusyBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncRun" ADD CONSTRAINT "CalendarSyncRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncRun" ADD CONSTRAINT "CalendarSyncRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarSyncRun" ADD CONSTRAINT "CalendarSyncRun_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionRequest" ADD CONSTRAINT "SuggestionRequest_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionRequest" ADD CONSTRAINT "SuggestionRequest_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionRequestAttendee" ADD CONSTRAINT "SuggestionRequestAttendee_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SuggestionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionRequestAttendee" ADD CONSTRAINT "SuggestionRequestAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestionCandidate" ADD CONSTRAINT "SuggestionCandidate_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SuggestionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
