-- AlterTable
ALTER TABLE "SuggestionRequest" ADD COLUMN     "eventArchetypeId" TEXT,
ADD COLUMN     "targetUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
