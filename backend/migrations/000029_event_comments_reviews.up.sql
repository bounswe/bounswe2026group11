ALTER TABLE event_comment
    ADD COLUMN comment_type TEXT NOT NULL DEFAULT 'DISCUSSION',
    ADD COLUMN rating INT,
    ADD COLUMN image_url TEXT,
    ADD COLUMN reply_count INT NOT NULL DEFAULT 0;

ALTER TABLE event_comment
    ADD CONSTRAINT chk_event_comment_counts CHECK (
        likes_count >= 0 AND reply_count >= 0
    ),
    ADD CONSTRAINT chk_event_comment_review_shape CHECK (
        (
            comment_type = 'DISCUSSION'
            AND rating IS NULL
            AND image_url IS NULL
        )
        OR (
            comment_type = 'REVIEW'
            AND parent_id IS NULL
            AND rating BETWEEN 1 AND 5
        )
    ),
    ADD CONSTRAINT chk_event_comment_type CHECK (comment_type IN ('DISCUSSION', 'REVIEW'));

CREATE UNIQUE INDEX uq_event_comment_review_event_user
    ON event_comment (event_id, user_id)
    WHERE comment_type = 'REVIEW';

CREATE INDEX idx_event_comment_collection_latest
    ON event_comment (event_id, comment_type, parent_id, created_at DESC, id DESC);

CREATE INDEX idx_event_comment_replies_latest
    ON event_comment (parent_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION validate_event_comment_parent() RETURNS trigger AS
$$
DECLARE
    parent_event_id UUID;
    parent_type TEXT;
    parent_parent_id UUID;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT event_id, comment_type, parent_id
    INTO parent_event_id, parent_type, parent_parent_id
    FROM event_comment
    WHERE id = NEW.parent_id;

    IF parent_event_id IS NULL THEN
        RAISE EXCEPTION 'comment parent does not exist';
    END IF;
    IF parent_event_id IS DISTINCT FROM NEW.event_id THEN
        RAISE EXCEPTION 'comment parent must belong to same event';
    END IF;
    IF parent_type <> 'DISCUSSION' THEN
        RAISE EXCEPTION 'comment parent must be a discussion comment';
    END IF;
    IF parent_parent_id IS NOT NULL THEN
        RAISE EXCEPTION 'nested replies are not supported';
    END IF;
    IF NEW.comment_type <> 'DISCUSSION' THEN
        RAISE EXCEPTION 'only discussion comments can be replies';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_comment_parent_validate
    BEFORE INSERT OR UPDATE OF event_id, parent_id, comment_type
    ON event_comment
    FOR EACH ROW
EXECUTE FUNCTION validate_event_comment_parent();

CREATE OR REPLACE FUNCTION sync_event_comment_reply_count() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*)
                FROM event_comment
                WHERE parent_id = OLD.parent_id
            )
            WHERE id = OLD.parent_id;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*)
                FROM event_comment
                WHERE parent_id = NEW.parent_id
            )
            WHERE id = NEW.parent_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*)
                FROM event_comment
                WHERE parent_id = OLD.parent_id
            )
            WHERE id = OLD.parent_id;
        END IF;
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*)
                FROM event_comment
                WHERE parent_id = NEW.parent_id
            )
            WHERE id = NEW.parent_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_comment_reply_count
    AFTER INSERT OR DELETE OR UPDATE OF parent_id
    ON event_comment
    FOR EACH ROW
EXECUTE FUNCTION sync_event_comment_reply_count();

UPDATE event_comment parent
SET reply_count = (
    SELECT COUNT(*)
    FROM event_comment child
    WHERE child.parent_id = parent.id
);

INSERT INTO event_comment (
    id,
    user_id,
    event_id,
    comment_type,
    message,
    rating,
    created_at,
    updated_at
)
SELECT
    er.id,
    er.participant_user_id,
    er.event_id,
    'REVIEW',
    COALESCE(NULLIF(BTRIM(er.message), ''), 'Rated this event.'),
    er.rating,
    er.created_at,
    er.updated_at
FROM event_rating er
ON CONFLICT (event_id, user_id) WHERE comment_type = 'REVIEW'
DO NOTHING;
