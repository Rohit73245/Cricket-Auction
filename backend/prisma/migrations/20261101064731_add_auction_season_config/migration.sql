-- CreateTable
CREATE TABLE "AuctionSeasonConfig" (
    "id" UUID NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "iplStatsCutoffDate" TIMESTAMP(3) NOT NULL,
    "domesticStatsCutoffDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionSeasonConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuctionSeasonConfig_season_idx" ON "AuctionSeasonConfig"("season");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionSeasonConfig_leagueId_season_key" ON "AuctionSeasonConfig"("leagueId", "season");
