-- Add projectId and enabled columns to apikey table
ALTER TABLE apikey
  ADD COLUMN "projectId" UUID REFERENCES project(id),
  ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT true;
