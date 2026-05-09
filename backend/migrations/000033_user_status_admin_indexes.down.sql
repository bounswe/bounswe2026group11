DROP INDEX IF EXISTS idx_join_request_status_created;
DROP INDEX IF EXISTS idx_invitation_status_created;
DROP INDEX IF EXISTS idx_event_report_category_created;
DROP INDEX IF EXISTS idx_app_user_status_created;

ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS chk_app_user_status;

ALTER TABLE app_user
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status DROP NOT NULL;
