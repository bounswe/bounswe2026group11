DELETE FROM participation p
USING event e
WHERE p.event_id = e.id
  AND p.user_id = e.host_id;

CREATE OR REPLACE FUNCTION sync_participation_counts() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event
        SET approved_participant_count = (SELECT COUNT(*)
                                          FROM participation
                                          WHERE event_id = OLD.event_id
                                            AND status = 'APPROVED'),
            pending_participant_count  = (SELECT COUNT(*)
                                          FROM participation
                                          WHERE event_id = OLD.event_id
                                            AND status = 'PENDING')
        WHERE id = OLD.event_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event
        SET approved_participant_count = (SELECT COUNT(*)
                                          FROM participation
                                          WHERE event_id = NEW.event_id
                                            AND status = 'APPROVED'),
            pending_participant_count  = (SELECT COUNT(*)
                                          FROM participation
                                          WHERE event_id = NEW.event_id
                                            AND status = 'PENDING')
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
            UPDATE event
            SET approved_participant_count = (SELECT COUNT(*)
                                              FROM participation
                                              WHERE event_id = OLD.event_id
                                                AND status = 'APPROVED'),
                pending_participant_count  = (SELECT COUNT(*)
                                              FROM participation
                                              WHERE event_id = OLD.event_id
                                                AND status = 'PENDING')
            WHERE id = OLD.event_id;
            UPDATE event
            SET approved_participant_count = (SELECT COUNT(*)
                                              FROM participation
                                              WHERE event_id = NEW.event_id
                                                AND status = 'APPROVED'),
                pending_participant_count  = (SELECT COUNT(*)
                                              FROM participation
                                              WHERE event_id = NEW.event_id
                                                AND status = 'PENDING')
            WHERE id = NEW.event_id;
        ELSE
            UPDATE event
            SET approved_participant_count = (SELECT COUNT(*)
                                              FROM participation
                                              WHERE event_id = NEW.event_id
                                                AND status = 'APPROVED'),
                pending_participant_count  = (SELECT COUNT(*)
                                              FROM participation
                                              WHERE event_id = NEW.event_id
                                                AND status = 'PENDING')
            WHERE id = NEW.event_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

UPDATE event e
SET approved_participant_count = (SELECT COUNT(*)
                                  FROM participation p
                                  WHERE p.event_id = e.id
                                    AND p.status = 'APPROVED'),
    pending_participant_count  = (SELECT COUNT(*)
                                  FROM participation p
                                  WHERE p.event_id = e.id
                                    AND p.status = 'PENDING');
