DROP TABLE IF EXISTS notification_delivery_attempt;

DROP INDEX IF EXISTS idx_notification_created_at;
DROP INDEX IF EXISTS idx_notification_user_unread_visible;
DROP INDEX IF EXISTS idx_notification_user_unread_visible_created;
DROP INDEX IF EXISTS idx_notification_user_visible_created;
DROP INDEX IF EXISTS uq_notification_receiver_idempotency;

ALTER TABLE notification
    ALTER COLUMN is_read DROP NOT NULL,
    ALTER COLUMN body DROP NOT NULL,
    ALTER COLUMN title DROP NOT NULL;

ALTER TABLE notification
    DROP COLUMN IF EXISTS deleted_at,
    DROP COLUMN IF EXISTS read_at,
    DROP COLUMN IF EXISTS idempotency_key,
    DROP COLUMN IF EXISTS data,
    DROP COLUMN IF EXISTS image_url;
