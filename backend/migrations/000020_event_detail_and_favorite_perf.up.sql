CREATE INDEX IF NOT EXISTS idx_event_constraint_event_id ON event_constraint (event_id);

CREATE INDEX IF NOT EXISTS idx_participation_event_status_created
    ON participation (event_id, status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_join_request_event_status_created
    ON join_request (event_id, status, created_at, id);

CREATE INDEX IF NOT EXISTS idx_invitation_event_created
    ON invitation (event_id, created_at, id);

CREATE OR REPLACE FUNCTION sync_favorite_count() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE event
        SET favorite_count = favorite_count + 1
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE event
        SET favorite_count = GREATEST(favorite_count - 1, 0)
        WHERE id = OLD.event_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
        UPDATE event
        SET favorite_count = GREATEST(favorite_count - 1, 0)
        WHERE id = OLD.event_id;

        UPDATE event
        SET favorite_count = favorite_count + 1
        WHERE id = NEW.event_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
