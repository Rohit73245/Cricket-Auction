-- CreateEnum
CREATE TYPE "PlayerRole" AS ENUM ('BATTER', 'BOWLER', 'ALL_ROUNDER', 'WICKET_KEEPER');

-- CreateEnum
CREATE TYPE "PlayerAuctionStatus" AS ENUM ('QUEUED', 'LIVE', 'SOLD', 'UNSOLD');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('VALID', 'INVALID');

-- CreateTable
CREATE TABLE "Player" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlayerRole" NOT NULL,
    "nationality" TEXT NOT NULL,
    "photoUrl" TEXT,
    "basePrice" DECIMAL(12,2) NOT NULL,
    "statistics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionTeam" (
    "id" UUID NOT NULL,
    "auctionId" UUID NOT NULL,
    "teamCode" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "totalPurse" DECIMAL(12,2) NOT NULL,
    "remainingPurse" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuctionPlayer" (
    "id" UUID NOT NULL,
    "auctionId" UUID NOT NULL,
    "playerId" UUID NOT NULL,
    "teamId" UUID,
    "status" "PlayerAuctionStatus" NOT NULL DEFAULT 'QUEUED',
    "queueOrder" INTEGER NOT NULL,
    "soldPrice" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuctionPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bid" (
    "id" UUID NOT NULL,
    "auctionId" UUID NOT NULL,
    "auctionPlayerId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "BidStatus" NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Player_name_idx" ON "Player"("name");

-- CreateIndex
CREATE INDEX "Player_role_idx" ON "Player"("role");

-- CreateIndex
CREATE INDEX "AuctionTeam_auctionId_idx" ON "AuctionTeam"("auctionId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionTeam_auctionId_teamCode_key" ON "AuctionTeam"("auctionId", "teamCode");

-- CreateIndex
CREATE INDEX "AuctionPlayer_auctionId_status_idx" ON "AuctionPlayer"("auctionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionPlayer_auctionId_playerId_key" ON "AuctionPlayer"("auctionId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "AuctionPlayer_auctionId_queueOrder_key" ON "AuctionPlayer"("auctionId", "queueOrder");

-- CreateIndex
CREATE INDEX "Bid_auctionId_createdAt_idx" ON "Bid"("auctionId", "createdAt");

-- CreateIndex
CREATE INDEX "Bid_auctionPlayerId_createdAt_idx" ON "Bid"("auctionPlayerId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuctionTeam" ADD CONSTRAINT "AuctionTeam_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionPlayer" ADD CONSTRAINT "AuctionPlayer_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionPlayer" ADD CONSTRAINT "AuctionPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuctionPlayer" ADD CONSTRAINT "AuctionPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AuctionTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionPlayerId_fkey" FOREIGN KEY ("auctionPlayerId") REFERENCES "AuctionPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bid" ADD CONSTRAINT "Bid_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "AuctionTeam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
