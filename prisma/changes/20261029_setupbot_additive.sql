-- Proposed, additive SQLite change for the five SetupBot/auth tables only.
-- NOT automatically applied: this repository has no Prisma migration baseline.
-- Before any production use, inspect the actual schema, make and test a backup,
-- establish a proper Prisma baseline, and rehearse/validate on an isolated copy.
-- It deliberately fails if any table/index already exists rather than masking drift.
PRAGMA foreign_keys=ON;
BEGIN TRANSACTION;

CREATE TABLE "SetupSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentStep" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "encryptedData" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SetupSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SetupSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SetupSession_companyId_userId_key" ON "SetupSession"("companyId", "userId");
CREATE INDEX "SetupSession_companyId_status_idx" ON "SetupSession"("companyId", "status");
CREATE INDEX "SetupSession_userId_idx" ON "SetupSession"("userId");

CREATE TABLE "SetupImport" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "encryptedPayload" TEXT NOT NULL,
  "verification" TEXT NOT NULL DEFAULT 'unverified',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SetupImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SetupImport_companyId_key" ON "SetupImport"("companyId");

CREATE TABLE "AuthLoginAttempt" (
  "accountHash" TEXT NOT NULL PRIMARY KEY,
  "failures" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" DATETIME,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "SetupManagedResource" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "credentialFingerprint" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "SetupManagedResource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SetupManagedResource_companyId_kind_resourceId_key" ON "SetupManagedResource"("companyId", "kind", "resourceId");
CREATE INDEX "SetupManagedResource_companyId_idx" ON "SetupManagedResource"("companyId");

CREATE TABLE "SetupHandoffReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "payloadFingerprint" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SetupHandoffReceipt_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SetupHandoffReceipt_companyId_idempotencyKey_key" ON "SetupHandoffReceipt"("companyId", "idempotencyKey");
CREATE INDEX "SetupHandoffReceipt_companyId_createdAt_idx" ON "SetupHandoffReceipt"("companyId", "createdAt");
COMMIT;
