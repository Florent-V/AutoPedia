-- CreateEnum
CREATE TYPE "AuctionStatus" AS ENUM ('OPEN', 'SOLD', 'UNSOLD', 'CANCELLED');

-- AlterTable
ALTER TABLE "player" ADD COLUMN     "auctionsSold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "auctionsWon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "botNextActionAt" TIMESTAMP(3),
ADD COLUMN     "botProfile" JSONB,
ADD COLUMN     "dailyStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastDailyClaim" TEXT;

-- CreateTable
CREATE TABLE "auction" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "carId" INTEGER NOT NULL,
    "startPrice" INTEGER NOT NULL,
    "currentBid" INTEGER,
    "bidderId" TEXT,
    "bidCount" INTEGER NOT NULL DEFAULT 0,
    "status" "AuctionStatus" NOT NULL DEFAULT 'OPEN',
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "auction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auction_status_endsAt_idx" ON "auction"("status", "endsAt");

-- CreateIndex
CREATE INDEX "auction_sellerId_status_idx" ON "auction"("sellerId", "status");

-- CreateIndex
CREATE INDEX "auction_bidderId_status_idx" ON "auction"("bidderId", "status");

-- CreateIndex
CREATE INDEX "bid_auctionId_createdAt_idx" ON "bid"("auctionId", "createdAt");

-- AddForeignKey
ALTER TABLE "auction" ADD CONSTRAINT "auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction" ADD CONSTRAINT "auction_carId_fkey" FOREIGN KEY ("carId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auction" ADD CONSTRAINT "auction_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid" ADD CONSTRAINT "bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bid" ADD CONSTRAINT "bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
