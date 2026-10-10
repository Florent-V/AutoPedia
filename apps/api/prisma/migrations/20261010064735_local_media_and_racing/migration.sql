-- AlterTable
ALTER TABLE "car" ADD COLUMN     "imageAuthor" TEXT,
ADD COLUMN     "imageCheckedAt" TIMESTAMP(3),
ADD COLUMN     "imageFile" TEXT,
ADD COLUMN     "imageLicense" TEXT,
ADD COLUMN     "imageLicenseUrl" TEXT,
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "racing" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "car_imagePath_idx" ON "car"("imagePath");
