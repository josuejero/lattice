-- CreateEnum
CREATE TYPE "ScheduledEventStatus" AS ENUM ('CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RsvpStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'TENTATIVE');

-- CreateEnum
CREATE TYPE "WriteBackStatus" AS ENUM ('NOT_REQUESTED', 'PENDING', 'SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "ScheduledEvent" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startUtc" TIMESTAMP(3) NOT NULL,
    "endUtc" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT NOT NULL,
    "status" "ScheduledEventStatus" NOT NULL DEFAULT 'CONFIRMED',
    "sourceRequestId" TEXT,
    "sourceCandidateRank" INTEGER,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT NOT NULL,
    "writeBackStatus" "WriteBackStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "externalProvider" TEXT,
    "externalCalendarId" TEXT,
    "externalEventId" TEXT,
    "externalEventHtmlLink" TEXT,
    "writeBackError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledEventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rsvp" "RsvpStatus" NOT NULL DEFAULT 'INVITED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledEventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduledEvent_orgId_startUtc_idx" ON "ScheduledEvent"("orgId", "startUtc");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledEvent_sourceRequestId_sourceCandidateRank_key" ON "ScheduledEvent"("sourceRequestId", "sourceCandidateRank");

-- CreateIndex
CREATE INDEX "ScheduledEventAttendee_userId_idx" ON "ScheduledEventAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduledEventAttendee_eventId_userId_key" ON "ScheduledEventAttendee"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Org"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "SuggestionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEvent" ADD CONSTRAINT "ScheduledEvent_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEventAttendee" ADD CONSTRAINT "ScheduledEventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "ScheduledEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduledEventAttendee" ADD CONSTRAINT "ScheduledEventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
