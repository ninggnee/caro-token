-- Migration v3: Remove grade requirement from farmer batches
-- quality_grade is now optional (nullable) — farmers no longer self-select grade.
-- Admins may still assign a grade internally for token-type routing.

ALTER TABLE asset_batches
  MODIFY COLUMN quality_grade VARCHAR(8) NULL DEFAULT NULL;

-- The column is kept (not dropped) to preserve historical records and admin-assigned grades.
-- If you wish to drop it entirely after confirming no production data depends on it, run:
--   ALTER TABLE asset_batches DROP COLUMN quality_grade;
