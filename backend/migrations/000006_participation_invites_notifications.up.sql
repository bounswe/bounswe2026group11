-- =========================
-- PARTICIPATION
-- =========================
CREATE TABLE participation
(
    id                           UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    event_id                     UUID                     NOT NULL,
    user_id                      UUID                     NOT NULL,
    status                       TEXT                     NOT NULL,
    reconfirmed_at               TIMESTAMP WITH TIME ZONE,
    last_confirmed_event_version INT,
    updated_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at                   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_participation_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT fk_participation_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT uq_event_user UNIQUE (event_id, user_id)
);

CREATE INDEX idx_participation_event_id ON participation (event_id);
CREATE INDEX idx_participation_user_id ON participation (user_id);

-- =========================
-- FAVORITE EVENT
-- =========================
CREATE TABLE favorite_event
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id    UUID                     NOT NULL,
    event_id   UUID                     NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_fav_event_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_fav_event_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT uq_favorite UNIQUE (user_id, event_id)
);
CREATE INDEX idx_favorite_event_user_id ON favorite_event (user_id);
CREATE INDEX idx_favorite_event_event_id ON favorite_event (event_id);

-- =========================
-- INVITATION
-- =========================
CREATE TABLE invitation
(
    id              UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    event_id        UUID                     NOT NULL,
    host_id         UUID                     NOT NULL,
    invited_user_id UUID                     NOT NULL,
    status          VARCHAR(50)              NOT NULL,
    message         TEXT,
    expires_at      TIMESTAMP WITH TIME ZONE,

    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_inv_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_host FOREIGN KEY (host_id) REFERENCES app_user (id),
    CONSTRAINT fk_inv_user FOREIGN KEY (invited_user_id) REFERENCES app_user (id),
    CONSTRAINT uq_invitation UNIQUE (event_id, invited_user_id)
);

CREATE INDEX idx_invitation_host_id ON invitation (host_id);
CREATE INDEX idx_invitation_invited_user_id ON invitation (invited_user_id);

-- =========================
-- NOTIFICATION
-- =========================
CREATE TABLE notification
(
    id               UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    event_id         UUID,
    receiver_user_id UUID                     NOT NULL,
    title            TEXT,
    type             VARCHAR,
    body             TEXT,
    is_read          BOOLEAN                           DEFAULT FALSE,
    deep_link        TEXT,
    delivery_method  VARCHAR,
    status           TEXT, -- SENT, FAILED
    sent_at          TIMESTAMP WITH TIME ZONE,

    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_notification_user FOREIGN KEY (receiver_user_id) REFERENCES app_user (id),
    CONSTRAINT fk_notification_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE SET NULL
);

CREATE INDEX idx_notification_user_id ON notification (receiver_user_id);
CREATE INDEX idx_delivery_method_and_status ON notification (delivery_method, status);
CREATE INDEX idx_notification_unread ON notification (receiver_user_id) WHERE is_read = false;

-- =========================
-- JOIN REQUEST
-- =========================
CREATE TABLE join_request
(
    id               UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    event_id         UUID                     NOT NULL,
    user_id          UUID                     NOT NULL,
    participation_id UUID,
    host_user_id     UUID                     NOT NULL,
    status           VARCHAR(50),
    message          TEXT,

    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_join_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT fk_join_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_join_host FOREIGN KEY (host_user_id) REFERENCES app_user (id),
    CONSTRAINT uq_join UNIQUE (event_id, user_id),
    CONSTRAINT fk_join_participation FOREIGN KEY (participation_id) REFERENCES participation (id) ON DELETE SET NULL
);
