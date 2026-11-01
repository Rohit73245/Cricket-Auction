-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "leagueRulesId" UUID;

-- CreateTable
CREATE TABLE "LeagueRules" (
    "id" UUID NOT NULL,
    "leagueId" TEXT NOT NULL,
    "rulesSourceSeason" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "teamPurse" DECIMAL(12,2) NOT NULL,
    "minimumSquadSize" INTEGER NOT NULL,
    "maximumSquadSize" INTEGER,
    "maximumOverseasPlayers" INTEGER,
    "maximumOverseasInXI" INTEGER,
    "minimumLocalPlayers" INTEGER,
    "minimumUnder22Players" INTEGER,
    "rulesSource" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueRules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeagueRules_leagueId_key" ON "LeagueRules"("leagueId");

-- CreateIndex
CREATE INDEX "Auction_leagueRulesId_idx" ON "Auction"("leagueRulesId");

-- AddForeignKey
ALTER TABLE "Auction" ADD CONSTRAINT "Auction_leagueRulesId_fkey" FOREIGN KEY ("leagueRulesId") REFERENCES "LeagueRules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
