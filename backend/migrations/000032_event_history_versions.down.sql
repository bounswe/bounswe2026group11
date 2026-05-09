DROP INDEX IF EXISTS idx_event_history_event_version_desc;

ALTER TABLE event_history
    DROP CONSTRAINT IF EXISTS fk_event_history_created_by_user;

ALTER TABLE event_history
    DROP COLUMN IF EXISTS event_updated_at,
    DROP COLUMN IF EXISTS created_by_user_id,
    DROP COLUMN IF EXISTS changed_fields,
    DROP COLUMN IF EXISTS snapshot;

ALTER TABLE event
    DROP CONSTRAINT IF EXISTS chk_event_version_no_positive;

ALTER TABLE event
    ALTER COLUMN version_no SET DEFAULT 0;
