CREATE TABLE user_push_device
(
    id              UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id         UUID                     NOT NULL,
    installation_id UUID                     NOT NULL,
    platform        TEXT                     NOT NULL,
    fcm_token       TEXT                     NOT NULL,
    device_info     TEXT,
    last_seen_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMP WITH TIME ZONE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_push_device_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_user_push_device_platform CHECK (platform IN ('IOS', 'ANDROID')),
    CONSTRAINT chk_user_push_device_fcm_token_nonempty CHECK (length(trim(fcm_token)) > 0)
);

CREATE UNIQUE INDEX uq_user_push_device_active_installation
    ON user_push_device (user_id, installation_id)
    WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX uq_user_push_device_active_fcm_token
    ON user_push_device (fcm_token)
    WHERE revoked_at IS NULL;

CREATE INDEX idx_user_push_device_user_active
    ON user_push_device (user_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;
