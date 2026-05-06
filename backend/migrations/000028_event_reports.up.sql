CREATE TABLE event_report
(
    id               UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    event_id         UUID                     NOT NULL,
    reporter_user_id UUID                     NOT NULL,
    report_category  TEXT                     NOT NULL,
    message          TEXT                     NOT NULL,
    image_url        TEXT,
    status           TEXT                     NOT NULL DEFAULT 'PENDING',

    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_report_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE,
    CONSTRAINT fk_event_report_reporter FOREIGN KEY (reporter_user_id) REFERENCES app_user (id) ON DELETE CASCADE,
    CONSTRAINT chk_event_report_category CHECK (
        report_category IN (
            'SAFETY',
            'HARASSMENT',
            'SPAM_OR_SCAM',
            'INAPPROPRIATE_CONTENT',
            'EVENT_NOT_AS_DESCRIBED',
            'ILLEGAL_OR_DANGEROUS',
            'OTHER'
        )
    ),
    CONSTRAINT chk_event_report_status CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED')),
    CONSTRAINT chk_event_report_message_length CHECK (
        length(btrim(message)) BETWEEN 1 AND 1000
    )
);

CREATE INDEX idx_event_report_event_created
    ON event_report (event_id, created_at DESC);

CREATE INDEX idx_event_report_reporter_created
    ON event_report (reporter_user_id, created_at DESC);

CREATE INDEX idx_event_report_status_created
    ON event_report (status, created_at DESC);
