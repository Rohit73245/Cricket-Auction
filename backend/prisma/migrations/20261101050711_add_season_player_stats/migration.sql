-- CreateEnum
CREATE TYPE "PlayerStatsSourceType" AS ENUM ('IPL', 'DOMESTIC_T20');

-- AlterTable
ALTER TABLE "AuctionPlayer" ADD COLUMN     "basePrice" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "PlayerSeasonStats" (
    "id" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "season" TEXT NOT NULL,
    "sourceType" "PlayerStatsSourceType" NOT NULL,
    "asOfDate" TIMESTAMP(3),
    "statistics" JSONB NOT NULL,
    "sourceName" TEXT,
    "sourceUrl" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerSeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayerSeasonStats_season_sourceType_idx" ON "PlayerSeasonStats"("season", "sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerSeasonStats_playerId_season_sourceType_key" ON "PlayerSeasonStats"("playerId", "season", "sourceType");

-- AddForeignKey
ALTER TABLE "PlayerSeasonStats" ADD CONSTRAINT "PlayerSeasonStats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
