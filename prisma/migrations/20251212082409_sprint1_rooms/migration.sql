-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('ONE_VS_ONE', 'THREE_VS_THREE');

-- CreateEnum
CREATE TYPE "BattleType" AS ENUM ('LISTENING', 'READING', 'WRITING', 'MIXED');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('BASIC', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('WAITING', 'PLAYING', 'FAILED', 'CLOSED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LISTENING', 'READING', 'WRITING');

-- CreateTable
CREATE TABLE "BattleRoom" (
    "id" TEXT NOT NULL,
    "roomCode" TEXT,
    "mode" "Mode" NOT NULL,
    "battleType" "BattleType" NOT NULL,
    "level" "Level" NOT NULL,
    "isRanked" BOOLEAN NOT NULL,
    "status" "RoomStatus" NOT NULL DEFAULT 'WAITING',
    "hostUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "failReason" TEXT,

    CONSTRAINT "BattleRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team" TEXT,
    "role" "Role",
    "isReady" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BattleRoom_roomCode_key" ON "BattleRoom"("roomCode");

-- CreateIndex
CREATE INDEX "BattleRoom_status_expiresAt_idx" ON "BattleRoom"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "RoomMember"("roomId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_team_role_key" ON "RoomMember"("roomId", "team", "role");

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "BattleRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
