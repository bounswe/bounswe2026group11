UPDATE app_user
SET status = 'active',
    updated_at = NOW()
WHERE status IS NULL OR btrim(status) = '';

ALTER TABLE app_user
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS chk_app_user_status;

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_status
        CHECK (status IN ('active', 'deactivated'));

CREATE INDEX IF NOT EXISTS idx_app_user_status_created
    ON app_user (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_event_report_category_created
    ON event_report (report_category, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_invitation_status_created
    ON invitation (status, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_join_request_status_created
    ON join_request (status, created_at DESC, id DESC);
