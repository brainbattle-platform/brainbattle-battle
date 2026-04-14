-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('CREATED', 'STARTED', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WinnerSide" AS ENUM ('A', 'B', 'DRAW');

-- CreateEnum
CREATE TYPE "RankTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "roomId" TEXT,
    "mode" "Mode" NOT NULL,
    "battleType" "BattleType" NOT NULL,
    "level" "Level" NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'CREATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "questionCount" INTEGER NOT NULL,
    "timeLimitSec" INTEGER NOT NULL,
    "winnerSide" "WinnerSide",
    "winReason" TEXT,
    "scoreA" INTEGER NOT NULL DEFAULT 0,
    "scoreB" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleParticipant" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "team" TEXT NOT NULL,
    "role" "Role",
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "totalTimeMs" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleQuestionInstance" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "bankType" "BattleType" NOT NULL,
    "level" "Level" NOT NULL,
    "questionId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctKey" TEXT NOT NULL,

    CONSTRAINT "BattleQuestionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleAnswer" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "questionInstId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedKey" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "timeMs" INTEGER NOT NULL,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BattleAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankProfile" (
    "userId" TEXT NOT NULL,
    "tier" "RankTier" NOT NULL DEFAULT 'BRONZE',
    "stars" INTEGER NOT NULL DEFAULT 0,
    "goldStars" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RankProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "RankHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "battleId" TEXT,
    "delta" INTEGER NOT NULL,
    "tierBefore" "RankTier" NOT NULL,
    "starsBefore" INTEGER NOT NULL,
    "goldBefore" INTEGER NOT NULL,
    "tierAfter" "RankTier" NOT NULL,
    "starsAfter" INTEGER NOT NULL,
    "goldAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RankHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionBankQuestion" (
    "id" TEXT NOT NULL,
    "bankType" "BattleType" NOT NULL,
    "level" "Level" NOT NULL,
    "prompt" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctKey" TEXT NOT NULL,
    "assetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionBankQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Battle_roomId_key" ON "Battle"("roomId");

-- CreateIndex
CREATE INDEX "Battle_status_createdAt_idx" ON "Battle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Battle_startedAt_idx" ON "Battle"("startedAt");

-- CreateIndex
CREATE INDEX "BattleParticipant_userId_createdAt_idx" ON "BattleParticipant"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BattleParticipant_battleId_team_idx" ON "BattleParticipant"("battleId", "team");

-- CreateIndex
CREATE UNIQUE INDEX "BattleParticipant_battleId_userId_key" ON "BattleParticipant"("battleId", "userId");

-- CreateIndex
CREATE INDEX "BattleQuestionInstance_battleId_idx" ON "BattleQuestionInstance"("battleId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleQuestionInstance_battleId_order_key" ON "BattleQuestionInstance"("battleId", "order");

-- CreateIndex
CREATE INDEX "BattleAnswer_battleId_userId_idx" ON "BattleAnswer"("battleId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "BattleAnswer_questionInstId_userId_key" ON "BattleAnswer"("questionInstId", "userId");

-- CreateIndex
CREATE INDEX "RankHistory_userId_createdAt_idx" ON "RankHistory"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RankHistory_battleId_idx" ON "RankHistory"("battleId");

-- CreateIndex
CREATE INDEX "QuestionBankQuestion_bankType_level_idx" ON "QuestionBankQuestion"("bankType", "level");

-- AddForeignKey
ALTER TABLE "BattleParticipant" ADD CONSTRAINT "BattleParticipant_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleQuestionInstance" ADD CONSTRAINT "BattleQuestionInstance_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleAnswer" ADD CONSTRAINT "BattleAnswer_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleAnswer" ADD CONSTRAINT "BattleAnswer_questionInstId_fkey" FOREIGN KEY ("questionInstId") REFERENCES "BattleQuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
