-- =========================
-- TICKET
-- =========================
CREATE TABLE ticket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id UUID NOT NULL,
    qr_token TEXT NOT NULL,
    status VARCHAR,
    expires_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_ticket_participation FOREIGN KEY (participation_id) REFERENCES participation(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_ticket_qr ON ticket(qr_token);

-- =========================
-- FEEDBACK
-- =========================
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id UUID NOT NULL,
    score FLOAT,
    message TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_feedback_participation FOREIGN KEY (participation_id) REFERENCES participation(id) ON DELETE CASCADE,
    CONSTRAINT chk_score CHECK (score >= 0 AND score <= 5)
);

-- =========================
-- COMMENT (TREE STRUCTURE)
-- =========================
CREATE TABLE event_comment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    message TEXT NOT NULL,
    parent_id UUID,
    likes_count INT DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT fk_comment_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_id) REFERENCES event_comment(id) ON DELETE CASCADE
);

CREATE INDEX idx_comment_event_id ON event_comment(event_id);

-- =========================
-- COMMENT LIKES
-- =========================
CREATE TABLE comment_like (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL,
    user_id UUID NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_like_comment FOREIGN KEY (comment_id) REFERENCES event_comment(id) ON DELETE CASCADE,
    CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT uq_comment_like UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_like_comment_id ON comment_like(comment_id);
