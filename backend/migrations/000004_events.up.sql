-- =========================
-- EVENT
-- =========================
CREATE TABLE event
(
    id                         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    host_id                    UUID                     NOT NULL,
    title                      TEXT                     NOT NULL,
    category_id                INT,
    description                TEXT,
    image_url                  TEXT,
    start_time                 TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time                   TIMESTAMP WITH TIME ZONE NOT NULL,
    privacy_level              TEXT                     NOT NULL,
    status                     TEXT,
    capacity                   INT,
    approved_participant_count INT                               DEFAULT 0,
    pending_participant_count  INT                               DEFAULT 0,
    favorite_count             INT                               DEFAULT 0,
    minimum_age                INT,
    preferred_gender           TEXT,
    location_type              TEXT,
    version_no                 INT                      NOT NULL DEFAULT 0,
    tag_text                   TEXT,
    search_vector              tsvector,

    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_host FOREIGN KEY (host_id) REFERENCES app_user (id),
    CONSTRAINT fk_event_category FOREIGN KEY (category_id) REFERENCES event_category (id),
    CONSTRAINT chk_event_time CHECK (start_time < end_time),
    CONSTRAINT chk_event_counts CHECK (
        approved_participant_count >= 0 AND
        pending_participant_count >= 0 AND
        favorite_count >= 0
        )
);

CREATE INDEX idx_event_host_id ON event (host_id);
CREATE INDEX idx_event_category_id ON event (category_id);
CREATE INDEX idx_event_start_time ON event (start_time);
CREATE INDEX idx_event_search ON event USING GIN (search_vector);
