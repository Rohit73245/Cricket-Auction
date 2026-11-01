-- AlterTable
ALTER TABLE "Auction" ADD COLUMN     "leagueId" TEXT,
ADD COLUMN     "season" TEXT,
ADD COLUMN     "selectedTeams" JSONB;
