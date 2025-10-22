/*
  Warnings:

  - A unique constraint covering the columns `[tokenHash]` on the table `Agent` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Job_agentId_status_idx";

-- CreateIndex
CREATE UNIQUE INDEX "Agent_tokenHash_key" ON "Agent"("tokenHash");

-- CreateIndex
CREATE INDEX "Agent_tokenHash_idx" ON "Agent"("tokenHash");

-- CreateIndex
CREATE INDEX "Job_agentId_idx" ON "Job"("agentId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");
