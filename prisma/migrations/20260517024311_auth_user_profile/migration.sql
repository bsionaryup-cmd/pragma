-- AlterTable
ALTER TABLE "users" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");
