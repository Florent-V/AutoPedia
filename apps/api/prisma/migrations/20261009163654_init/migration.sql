-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
);

-- CreateTable
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
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
);

-- CreateTable
CREATE TABLE "player" (
    "userId" TEXT NOT NULL,
    "boosters" INTEGER NOT NULL,
    "boosterAnchor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "boostersOpened" INTEGER NOT NULL DEFAULT 0,
    "cardsObtained" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "player_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "user_card" (
    "userId" TEXT NOT NULL,
    "carId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "firstObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastObtainedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_card_pkey" PRIMARY KEY ("userId","carId")
);

-- CreateTable
CREATE TABLE "booster_opening" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "carIds" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booster_opening_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievement" (
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievement_pkey" PRIMARY KEY ("userId","achievementId")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "car_externalId_key" ON "car"("externalId");

-- CreateIndex
CREATE INDEX "car_rarity_active_idx" ON "car"("rarity", "active");

-- CreateIndex
CREATE INDEX "car_manufacturer_idx" ON "car"("manufacturer");

-- CreateIndex
CREATE INDEX "user_card_carId_idx" ON "user_card"("carId");

-- CreateIndex
CREATE INDEX "booster_opening_userId_createdAt_idx" ON "booster_opening"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player" ADD CONSTRAINT "player_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_card" ADD CONSTRAINT "user_card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_card" ADD CONSTRAINT "user_card_carId_fkey" FOREIGN KEY ("carId") REFERENCES "car"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booster_opening" ADD CONSTRAINT "booster_opening_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievement" ADD CONSTRAINT "user_achievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
