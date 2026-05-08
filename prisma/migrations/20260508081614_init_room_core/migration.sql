/*
  Warnings:

  - You are about to drop the column `battleType` on the `BattleRoom` table. All the data in the column will be lost.
  - You are about to drop the column `failReason` on the `BattleRoom` table. All the data in the column will be lost.
  - You are about to drop the column `level` on the `BattleRoom` table. All the data in the column will be lost.
  - You are about to drop the column `mode` on the `BattleRoom` table. All the data in the column will be lost.
  - You are about to drop the column `roomCode` on the `BattleRoom` table. All the data in the column will be lost.
  - The `status` column on the `BattleRoom` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `role` column on the `RoomMember` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Battle` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BattleAnswer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BattleParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BattleQuestionInstance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionBankQuestion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RankHistory` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RankProfile` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code]` on the table `BattleRoom` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `BattleRoom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `format` to the `BattleRoom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skill` to the `BattleRoom` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `BattleRoom` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `team` on the `RoomMember` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "BattleFormat" AS ENUM ('DUEL_1V1', 'TEAM_3V3');

-- CreateEnum
CREATE TYPE "BattleSkill" AS ENUM ('GRAMMAR', 'LISTENING', 'VOCABULARY', 'MIXED');

-- CreateEnum
CREATE TYPE "BattleRole" AS ENUM ('GRAMMAR', 'LISTENING', 'VOCABULARY');

-- CreateEnum
CREATE TYPE "RoomTeam" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "BattleRoomStatus" AS ENUM ('WAITING', 'READY', 'PLAYING', 'FINISHED', 'CANCELLED', 'EXPIRED');

-- DropForeignKey
ALTER TABLE "BattleAnswer" DROP CONSTRAINT "BattleAnswer_battleId_fkey";

-- DropForeignKey
ALTER TABLE "BattleAnswer" DROP CONSTRAINT "BattleAnswer_questionInstId_fkey";

-- DropForeignKey
ALTER TABLE "BattleParticipant" DROP CONSTRAINT "BattleParticipant_battleId_fkey";

-- DropForeignKey
ALTER TABLE "BattleQuestionInstance" DROP CONSTRAINT "BattleQuestionInstance_battleId_fkey";

-- DropIndex
DROP INDEX "BattleRoom_roomCode_key";

-- DropIndex
DROP INDEX "BattleRoom_status_expiresAt_idx";

-- AlterTable
ALTER TABLE "BattleRoom" DROP COLUMN "battleType",
DROP COLUMN "failReason",
DROP COLUMN "level",
DROP COLUMN "mode",
DROP COLUMN "roomCode",
ADD COLUMN     "closeReason" TEXT,
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "format" "BattleFormat" NOT NULL,
ADD COLUMN     "skill" "BattleSkill" NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "isRanked" SET DEFAULT false,
DROP COLUMN "status",
ADD COLUMN     "status" "BattleRoomStatus" NOT NULL DEFAULT 'WAITING',
ALTER COLUMN "expiresAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "RoomMember" DROP COLUMN "team",
ADD COLUMN     "team" "RoomTeam" NOT NULL,
DROP COLUMN "role",
ADD COLUMN     "role" "BattleRole";

-- DropTable
DROP TABLE "Battle";

-- DropTable
DROP TABLE "BattleAnswer";

-- DropTable
DROP TABLE "BattleParticipant";

-- DropTable
DROP TABLE "BattleQuestionInstance";

-- DropTable
DROP TABLE "QuestionBankQuestion";

-- DropTable
DROP TABLE "RankHistory";

-- DropTable
DROP TABLE "RankProfile";

-- DropEnum
DROP TYPE "BattleStatus";

-- DropEnum
DROP TYPE "BattleType";

-- DropEnum
DROP TYPE "Level";

-- DropEnum
DROP TYPE "Mode";

-- DropEnum
DROP TYPE "RankTier";

-- DropEnum
DROP TYPE "Role";

-- DropEnum
DROP TYPE "RoomStatus";

-- DropEnum
DROP TYPE "WinnerSide";

-- CreateIndex
CREATE UNIQUE INDEX "BattleRoom_code_key" ON "BattleRoom"("code");

-- CreateIndex
CREATE INDEX "BattleRoom_status_idx" ON "BattleRoom"("status");

-- CreateIndex
CREATE INDEX "BattleRoom_code_idx" ON "BattleRoom"("code");

-- CreateIndex
CREATE INDEX "BattleRoom_hostUserId_idx" ON "BattleRoom"("hostUserId");

-- CreateIndex
CREATE INDEX "BattleRoom_createdAt_idx" ON "BattleRoom"("createdAt");

-- CreateIndex
CREATE INDEX "RoomMember_userId_idx" ON "RoomMember"("userId");

-- CreateIndex
CREATE INDEX "RoomMember_roomId_leftAt_idx" ON "RoomMember"("roomId", "leftAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_team_role_key" ON "RoomMember"("roomId", "team", "role");
