-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OFFICER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "guidelineDate" TEXT,
    "sourceDocUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "subsidyGeneralPct" DOUBLE PRECISION NOT NULL,
    "subsidyDifficultPct" DOUBLE PRECISION NOT NULL,
    "subsidyCapAmount" DOUBLE PRECISION NOT NULL,
    "subsidyCapLabel" TEXT,
    "minEquityGeneralPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "minEquityDifficultPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "minTermLoanGeneralPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "minTermLoanDifficultPct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "netWorthMultiplierGeneral" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "netWorthMultiplierDifficult" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "processingFeeGeneral" DOUBLE PRECISION NOT NULL DEFAULT 20000,
    "processingFeeScSt" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "performanceSecurityPct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "passThresholdGeneralPct" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "passThresholdScStPct" DOUBLE PRECISION NOT NULL DEFAULT 45,
    "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "coolOffYears" INTEGER NOT NULL DEFAULT 2,
    "maxProjectsPerDecade" INTEGER NOT NULL DEFAULT 2,
    "budgetAllocationAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "eoiReleaseDate" TIMESTAMP(3),
    "eoiClosingDate" TIMESTAMP(3),
    "outerSubmissionDays" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringCriterion" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "parentCode" TEXT,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "stage" TEXT NOT NULL DEFAULT 'DOCUMENT',
    "inputType" TEXT NOT NULL DEFAULT 'MANUAL',
    "bandConfig" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "applicationNo" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "isDifficultArea" BOOLEAN NOT NULL DEFAULT false,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "totalProjectCost" DOUBLE PRECISION,
    "eligibleProjectCost" DOUBLE PRECISION,
    "subsidySought" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalLetterDate" TIMESTAMP(3),
    "approvedGrantAmount" DOUBLE PRECISION,
    "assignedOfficerId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disbursement" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "installment" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "actualDate" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "delayReason" TEXT,
    "revisedExpectedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disbursement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDataValue" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldValue" TEXT NOT NULL,

    CONSTRAINT "ApplicationDataValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EligibilityCheck" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EligibilityCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationScore" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "marksAwarded" DOUBLE PRECISION NOT NULL,
    "remarks" TEXT,
    "scoredById" TEXT,
    "scoredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL,
    "percentageScore" DOUBLE PRECISION NOT NULL,
    "eligibilityPassed" BOOLEAN NOT NULL,
    "verdict" TEXT NOT NULL,
    "notes" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "actorId" TEXT,
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Scheme_code_key" ON "Scheme"("code");

-- CreateIndex
CREATE INDEX "ScoringCriterion_schemeId_idx" ON "ScoringCriterion"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_applicationNo_key" ON "Application"("applicationNo");

-- CreateIndex
CREATE INDEX "Application_schemeId_idx" ON "Application"("schemeId");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Disbursement_applicationId_idx" ON "Disbursement"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDataValue_applicationId_fieldKey_key" ON "ApplicationDataValue"("applicationId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationScore_applicationId_criterionId_key" ON "ApplicationScore"("applicationId", "criterionId");

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_applicationId_key" ON "Recommendation"("applicationId");

-- AddForeignKey
ALTER TABLE "ScoringCriterion" ADD CONSTRAINT "ScoringCriterion_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "Scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_assignedOfficerId_fkey" FOREIGN KEY ("assignedOfficerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disbursement" ADD CONSTRAINT "Disbursement_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDataValue" ADD CONSTRAINT "ApplicationDataValue_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EligibilityCheck" ADD CONSTRAINT "EligibilityCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScore" ADD CONSTRAINT "ApplicationScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScore" ADD CONSTRAINT "ApplicationScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScoringCriterion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationScore" ADD CONSTRAINT "ApplicationScore_scoredById_fkey" FOREIGN KEY ("scoredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
