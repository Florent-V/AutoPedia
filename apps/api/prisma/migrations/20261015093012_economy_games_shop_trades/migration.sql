-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('DUEL', 'QUIZ');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "player" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopPurchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sinceEpic" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sinceLegendary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tradesCompleted" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "credit_transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ref" TEXT,
    "balance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "GameType" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "state" JSONB NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "rewardCarId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "game_session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerKey" TEXT NOT NULL,
    "carId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_offer" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "offeredCarId" INTEGER NOT NULL,
    "wantedCarId" INTEGER,
    "price" INTEGER,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "buyerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "trade_offer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_transaction_userId_createdAt_idx" ON "credit_transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "game_session_userId_type_createdAt_idx" ON "game_session"("userId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "shop_purchase_userId_offerKey_key" ON "shop_purchase"("userId", "offerKey");

-- CreateIndex
CREATE INDEX "trade_offer_status_createdAt_idx" ON "trade_offer"("status", "createdAt");

-- CreateIndex
CREATE INDEX "trade_offer_sellerId_status_idx" ON "trade_offer"("sellerId", "status");

-- CreateIndex
CREATE INDEX "trade_offer_offeredCarId_status_idx" ON "trade_offer"("offeredCarId", "status");

-- CreateIndex
CREATE INDEX "trade_offer_wantedCarId_status_idx" ON "trade_offer"("wantedCarId", "status");

-- AddForeignKey
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_purchase" ADD CONSTRAINT "shop_purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_offeredCarId_fkey" FOREIGN KEY ("offeredCarId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_wantedCarId_fkey" FOREIGN KEY ("wantedCarId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
