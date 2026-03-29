CREATE TABLE event_rating
(
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    participant_user_id UUID                     NOT NULL,
    event_id            UUID                     NOT NULL,
    rating              INT                      NOT NULL,
    message             TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_rating_participant FOREIGN KEY (participant_user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_rating_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT uq_event_rating_participant_event UNIQUE (participant_user_id, event_id),
    CONSTRAINT chk_event_rating_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_event_rating_message CHECK (message IS NULL OR char_length(message) BETWEEN 10 AND 100)
);

CREATE INDEX idx_event_rating_event_id ON event_rating (event_id);
CREATE INDEX idx_event_rating_participant_user_id ON event_rating (participant_user_id);

CREATE TABLE participant_rating
(
    id                  UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    host_user_id        UUID                     NOT NULL,
    participant_user_id UUID                     NOT NULL,
    event_id            UUID                     NOT NULL,
    rating              INT                      NOT NULL,
    message             TEXT,
    created_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_participant_rating_host FOREIGN KEY (host_user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_rating_participant FOREIGN KEY (participant_user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_rating_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT uq_participant_rating_host_participant_event UNIQUE (host_user_id, participant_user_id, event_id),
    CONSTRAINT chk_participant_rating_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_participant_rating_message CHECK (message IS NULL OR char_length(message) BETWEEN 10 AND 100)
);

CREATE INDEX idx_participant_rating_event_id ON participant_rating (event_id);
CREATE INDEX idx_participant_rating_host_user_id ON participant_rating (host_user_id);
CREATE INDEX idx_participant_rating_participant_user_id ON participant_rating (participant_user_id);

CREATE TABLE user_score
(
    user_id                    UUID PRIMARY KEY,
    participant_score          DOUBLE PRECISION,
    participant_rating_count   INT                      NOT NULL DEFAULT 0,
    hosted_event_score         DOUBLE PRECISION,
    hosted_event_rating_count  INT                      NOT NULL DEFAULT 0,
    final_score                DOUBLE PRECISION,
    created_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at                 TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_score_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_user_score_counts CHECK (
        participant_rating_count >= 0 AND
        hosted_event_rating_count >= 0
    )
);
