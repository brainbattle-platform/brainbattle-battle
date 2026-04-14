/*
  Warnings:

  - Made the column `roomCode` on table `BattleRoom` required. This step will fail if there are existing NULL values in that column.
  - Made the column `team` on table `RoomMember` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "RoomMember" DROP CONSTRAINT "RoomMember_roomId_fkey";

-- AlterTable
ALTER TABLE "BattleRoom" ALTER COLUMN "roomCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "RoomMember" ALTER COLUMN "team" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "BattleRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
