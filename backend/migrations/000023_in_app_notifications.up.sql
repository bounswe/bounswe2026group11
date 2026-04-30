ALTER TABLE notification
    ADD COLUMN image_url TEXT,
    ADD COLUMN data JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN idempotency_key TEXT,
    ADD COLUMN read_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;

UPDATE notification
SET idempotency_key = 'LEGACY:' || id::text,
    title = COALESCE(title, ''),
    body = COALESCE(body, ''),
    is_read = COALESCE(is_read, FALSE),
    read_at = CASE
        WHEN is_read = TRUE THEN COALESCE(read_at, updated_at)
        ELSE read_at
    END;

ALTER TABLE notification
    ALTER COLUMN idempotency_key SET NOT NULL,
    ALTER COLUMN title SET NOT NULL,
    ALTER COLUMN body SET NOT NULL,
    ALTER COLUMN is_read SET NOT NULL;

CREATE UNIQUE INDEX uq_notification_receiver_idempotency
    ON notification (receiver_user_id, idempotency_key);

CREATE INDEX idx_notification_user_visible_created
    ON notification (receiver_user_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX idx_notification_user_unread_visible_created
    ON notification (receiver_user_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL AND is_read = FALSE;

CREATE INDEX idx_notification_user_unread_visible
    ON notification (receiver_user_id)
    WHERE deleted_at IS NULL AND is_read = FALSE;

CREATE INDEX idx_notification_created_at
    ON notification (created_at);

CREATE TABLE notification_delivery_attempt
(
    id               UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    notification_id  UUID                     NOT NULL,
    receiver_user_id UUID                     NOT NULL,
    method           TEXT                     NOT NULL,
    status           TEXT                     NOT NULL,
    push_device_id   UUID,
    error_summary    TEXT,
    sent_at          TIMESTAMP WITH TIME ZONE,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_notification_delivery_attempt_notification
        FOREIGN KEY (notification_id) REFERENCES notification (id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_delivery_attempt_user
        FOREIGN KEY (receiver_user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_delivery_attempt_push_device
        FOREIGN KEY (push_device_id) REFERENCES user_push_device (id) ON DELETE SET NULL,
    CONSTRAINT chk_notification_delivery_attempt_method CHECK (method IN ('FCM', 'SSE')),
    CONSTRAINT chk_notification_delivery_attempt_status CHECK (status IN ('SENT', 'FAILED', 'SKIPPED'))
);

CREATE INDEX idx_notification_delivery_attempt_notification
    ON notification_delivery_attempt (notification_id, created_at DESC);

CREATE INDEX idx_notification_delivery_attempt_user
    ON notification_delivery_attempt (receiver_user_id, created_at DESC);

INSERT INTO notification_delivery_attempt (
    notification_id,
    receiver_user_id,
    method,
    status,
    sent_at,
    created_at
)
SELECT id,
       receiver_user_id,
       delivery_method,
       status,
       sent_at,
       COALESCE(sent_at, created_at)
FROM notification
WHERE delivery_method IN ('FCM', 'SSE')
  AND status IN ('SENT', 'FAILED', 'SKIPPED');
