-- DropIndex
DROP INDEX "reviews_productId_userId_key";

-- CreateIndex
CREATE INDEX "reviews_userId_idx" ON "reviews"("userId");
