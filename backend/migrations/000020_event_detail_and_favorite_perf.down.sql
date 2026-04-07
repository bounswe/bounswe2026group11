DROP INDEX IF EXISTS idx_invitation_event_created;
DROP INDEX IF EXISTS idx_join_request_event_status_created;
DROP INDEX IF EXISTS idx_participation_event_status_created;
DROP INDEX IF EXISTS idx_event_constraint_event_id;

CREATE OR REPLACE FUNCTION sync_favorite_count() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event
        SET favorite_count = (SELECT COUNT(*)
                              FROM favorite_event
                              WHERE event_id = OLD.event_id)
        WHERE id = OLD.event_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event
        SET favorite_count = (SELECT COUNT(*)
                              FROM favorite_event
                              WHERE event_id = NEW.event_id)
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
        UPDATE event
        SET favorite_count = (SELECT COUNT(*)
                              FROM favorite_event
                              WHERE event_id = OLD.event_id)
        WHERE id = OLD.event_id;

        UPDATE event
        SET favorite_count = (SELECT COUNT(*)
                              FROM favorite_event
                              WHERE event_id = NEW.event_id)
        WHERE id = NEW.event_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
