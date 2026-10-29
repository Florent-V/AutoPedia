<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Schéma de Garage, identique à celui des migrations Prisma de apps/api (mêmes tables, colonnes et types) :
 * les deux backends peuvent servir la même base, et la même suite de tests de bout en bout s'applique aux deux.
 * Généré à partir de les fichiers migration.sql de apps/api/prisma/migrations (74 instructions).
 */
final class Version20261028000000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Schéma initial de Garage (identique au schéma Prisma)';
    }

    public function up(Schema $schema): void
    {
        $this->addSql(<<<'SQL'
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY')
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "car" (
    "id" SERIAL NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manufacturer" TEXT,
    "country" TEXT,
    "yearStart" INTEGER,
    "yearEnd" INTEGER,
    "imageUrl" TEXT,
    "wikiTitle" TEXT,
    "wikiLang" TEXT,
    "summary" TEXT,
    "summaryFetchedAt" TIMESTAMP(3),
    "powerKw" DOUBLE PRECISION,
    "topSpeedKmh" DOUBLE PRECISION,
    "massKg" DOUBLE PRECISION,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "rarity" "Rarity" NOT NULL DEFAULT 'COMMON',
    "rarityOverride" "Rarity",
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "car_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "player" (
    "userId" TEXT NOT NULL,
    "boosters" INTEGER NOT NULL,
    "boosterAnchor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boostersOpened" INTEGER NOT NULL DEFAULT 0,
    "cardsObtained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("userId")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "user_card" (
    "userId" TEXT NOT NULL,
    "carId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "firstObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_card_pkey" PRIMARY KEY ("userId","carId")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "booster_opening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "carIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booster_opening_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "user_achievement" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("userId","achievementId")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE UNIQUE INDEX "user_email_key" ON "user"("email")
SQL);
        $this->addSql(<<<'SQL'
CREATE UNIQUE INDEX "session_token_key" ON "session"("token")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "session_userId_idx" ON "session"("userId")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "account_userId_idx" ON "account"("userId")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier")
SQL);
        $this->addSql(<<<'SQL'
CREATE UNIQUE INDEX "car_externalId_key" ON "car"("externalId")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "car_rarity_active_idx" ON "car"("rarity", "active")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "car_manufacturer_idx" ON "car"("manufacturer")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "user_card_carId_idx" ON "user_card"("carId")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "booster_opening_userId_createdAt_idx" ON "booster_opening"("userId", "createdAt")
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "player" ADD CONSTRAINT "player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "user_card" ADD CONSTRAINT "user_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "user_card" ADD CONSTRAINT "user_card_carId_fkey" FOREIGN KEY ("carId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "booster_opening" ADD CONSTRAINT "booster_opening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "player" ADD COLUMN     "fullNotifiedAnchor" TIMESTAMP(3)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "push_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "push_subscription_userId_idx" ON "push_subscription"("userId")
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "car" ADD COLUMN     "imageAuthor" TEXT,
ADD COLUMN     "imageCheckedAt" TIMESTAMP(3),
ADD COLUMN     "imageFile" TEXT,
ADD COLUMN     "imageLicense" TEXT,
ADD COLUMN     "imageLicenseUrl" TEXT,
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "racing" BOOLEAN NOT NULL DEFAULT false
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "car_imagePath_idx" ON "car"("imagePath")
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "car" ADD COLUMN     "lengthMm" INTEGER
SQL);
        $this->addSql(<<<'SQL'
CREATE TYPE "GameType" AS ENUM ('DUEL', 'QUIZ')
SQL);
        $this->addSql(<<<'SQL'
CREATE TYPE "GameStatus" AS ENUM ('ACTIVE', 'FINISHED')
SQL);
        $this->addSql(<<<'SQL'
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED')
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "player" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "creditsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gamesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopPurchases" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sinceEpic" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sinceLegendary" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tradesCompleted" INTEGER NOT NULL DEFAULT 0
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "credit_transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "ref" TEXT,
    "balance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
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
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "shop_purchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "offerKey" TEXT NOT NULL,
    "carId" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shop_purchase_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
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
)
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "credit_transaction_userId_createdAt_idx" ON "credit_transaction"("userId", "createdAt")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "game_session_userId_type_createdAt_idx" ON "game_session"("userId", "type", "createdAt")
SQL);
        $this->addSql(<<<'SQL'
CREATE UNIQUE INDEX "shop_purchase_userId_offerKey_key" ON "shop_purchase"("userId", "offerKey")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "trade_offer_status_createdAt_idx" ON "trade_offer"("status", "createdAt")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "trade_offer_sellerId_status_idx" ON "trade_offer"("sellerId", "status")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "trade_offer_offeredCarId_status_idx" ON "trade_offer"("offeredCarId", "status")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "trade_offer_wantedCarId_status_idx" ON "trade_offer"("wantedCarId", "status")
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "game_session" ADD CONSTRAINT "game_session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "shop_purchase" ADD CONSTRAINT "shop_purchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_offeredCarId_fkey" FOREIGN KEY ("offeredCarId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_wantedCarId_fkey" FOREIGN KEY ("wantedCarId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "trade_offer" ADD CONSTRAINT "trade_offer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TYPE "GameType" ADD VALUE 'WEIGHT'
SQL);
        $this->addSql(<<<'SQL'
ALTER TYPE "GameType" ADD VALUE 'MYSTERY'
SQL);
        $this->addSql(<<<'SQL'
ALTER TYPE "GameType" ADD VALUE 'DOORS'
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "player" ADD COLUMN     "doorsJackpots" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gameCardsWon" INTEGER NOT NULL DEFAULT 0
SQL);
        $this->addSql(<<<'SQL'
CREATE TYPE "AuctionStatus" AS ENUM ('OPEN', 'SOLD', 'UNSOLD', 'CANCELLED')
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "player" ADD COLUMN     "auctionsSold" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "auctionsWon" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "botNextActionAt" TIMESTAMP(3),
ADD COLUMN     "botProfile" JSONB,
ADD COLUMN     "dailyStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isBot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastDailyClaim" TEXT
SQL);
        $this->addSql(<<<'SQL'
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
)
SQL);
        $this->addSql(<<<'SQL'
CREATE TABLE "bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bid_pkey" PRIMARY KEY ("id")
)
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "auction_status_endsAt_idx" ON "auction"("status", "endsAt")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "auction_sellerId_status_idx" ON "auction"("sellerId", "status")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "auction_bidderId_status_idx" ON "auction"("bidderId", "status")
SQL);
        $this->addSql(<<<'SQL'
CREATE INDEX "bid_auctionId_createdAt_idx" ON "bid"("auctionId", "createdAt")
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "auction" ADD CONSTRAINT "auction_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "auction" ADD CONSTRAINT "auction_carId_fkey" FOREIGN KEY ("carId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "auction" ADD CONSTRAINT "auction_bidderId_fkey" FOREIGN KEY ("bidderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "bid" ADD CONSTRAINT "bid_auctionId_fkey" FOREIGN KEY ("auctionId") REFERENCES "auction"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
        $this->addSql(<<<'SQL'
ALTER TABLE "bid" ADD CONSTRAINT "bid_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
SQL);
    }

    public function down(Schema $schema): void
    {
        $this->throwIrreversibleMigrationException('Migration initiale : supprimer la base pour repartir de zéro.');
    }
}
