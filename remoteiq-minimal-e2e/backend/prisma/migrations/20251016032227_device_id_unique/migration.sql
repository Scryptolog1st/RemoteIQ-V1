/*
  Warnings:

  - A unique constraint covering the columns `[deviceId]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Agent_deviceId_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Agent_deviceId_key" ON "Agent"("deviceId");
