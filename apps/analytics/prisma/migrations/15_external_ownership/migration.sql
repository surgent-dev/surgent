-- AlterTable
ALTER TABLE "website"
  ADD COLUMN "external_project_id" UUID,
  ADD COLUMN "external_org_id" UUID,
  ADD COLUMN "external_user_id" UUID;

-- AlterTable
ALTER TABLE "report"
  ALTER COLUMN "user_id" DROP NOT NULL,
  ADD COLUMN "external_project_id" UUID,
  ADD COLUMN "external_org_id" UUID,
  ADD COLUMN "external_user_id" UUID;

-- AlterTable
ALTER TABLE "link"
  ADD COLUMN "external_project_id" UUID,
  ADD COLUMN "external_org_id" UUID,
  ADD COLUMN "external_user_id" UUID;

-- AlterTable
ALTER TABLE "pixel"
  ADD COLUMN "external_project_id" UUID,
  ADD COLUMN "external_org_id" UUID,
  ADD COLUMN "external_user_id" UUID;

-- CreateIndex
CREATE INDEX "website_external_project_id_idx" ON "website"("external_project_id");

-- CreateIndex
CREATE INDEX "website_external_org_id_idx" ON "website"("external_org_id");

-- CreateIndex
CREATE INDEX "website_external_user_id_idx" ON "website"("external_user_id");

-- CreateIndex
CREATE INDEX "report_external_project_id_idx" ON "report"("external_project_id");

-- CreateIndex
CREATE INDEX "report_external_org_id_idx" ON "report"("external_org_id");

-- CreateIndex
CREATE INDEX "report_external_user_id_idx" ON "report"("external_user_id");

-- CreateIndex
CREATE INDEX "link_external_project_id_idx" ON "link"("external_project_id");

-- CreateIndex
CREATE INDEX "link_external_org_id_idx" ON "link"("external_org_id");

-- CreateIndex
CREATE INDEX "link_external_user_id_idx" ON "link"("external_user_id");

-- CreateIndex
CREATE INDEX "pixel_external_project_id_idx" ON "pixel"("external_project_id");

-- CreateIndex
CREATE INDEX "pixel_external_org_id_idx" ON "pixel"("external_org_id");

-- CreateIndex
CREATE INDEX "pixel_external_user_id_idx" ON "pixel"("external_user_id");
