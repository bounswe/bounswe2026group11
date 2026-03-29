-- Keep host membership internal by excluding host-owned participation rows from
-- the denormalized participant counters on the event table.
CREATE OR REPLACE FUNCTION sync_participation_counts() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event e
        SET approved_participant_count = (SELECT COUNT(*)
                                          FROM participation p
                                          WHERE p.event_id = OLD.event_id
                                            AND p.status = 'APPROVED'
                                            AND p.user_id <> e.host_id),
            pending_participant_count  = (SELECT COUNT(*)
                                          FROM participation p
                                          WHERE p.event_id = OLD.event_id
                                            AND p.status = 'PENDING'
                                            AND p.user_id <> e.host_id)
        WHERE e.id = OLD.event_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event e
        SET approved_participant_count = (SELECT COUNT(*)
                                          FROM participation p
                                          WHERE p.event_id = NEW.event_id
                                            AND p.status = 'APPROVED'
                                            AND p.user_id <> e.host_id),
            pending_participant_count  = (SELECT COUNT(*)
                                          FROM participation p
                                          WHERE p.event_id = NEW.event_id
                                            AND p.status = 'PENDING'
                                            AND p.user_id <> e.host_id)
        WHERE e.id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
            UPDATE event e
            SET approved_participant_count = (SELECT COUNT(*)
                                              FROM participation p
                                              WHERE p.event_id = OLD.event_id
                                                AND p.status = 'APPROVED'
                                                AND p.user_id <> e.host_id),
                pending_participant_count  = (SELECT COUNT(*)
                                              FROM participation p
                                              WHERE p.event_id = OLD.event_id
                                                AND p.status = 'PENDING'
                                                AND p.user_id <> e.host_id)
            WHERE e.id = OLD.event_id;
            UPDATE event e
            SET approved_participant_count = (SELECT COUNT(*)
                                              FROM participation p
                                              WHERE p.event_id = NEW.event_id
                                                AND p.status = 'APPROVED'
                                                AND p.user_id <> e.host_id),
                pending_participant_count  = (SELECT COUNT(*)
                                              FROM participation p
                                              WHERE p.event_id = NEW.event_id
                                                AND p.status = 'PENDING'
                                                AND p.user_id <> e.host_id)
            WHERE e.id = NEW.event_id;
        ELSE
            UPDATE event e
            SET approved_participant_count = (SELECT COUNT(*)
                                              FROM participation p
                                              WHERE p.event_id = NEW.event_id
                                                AND p.status = 'APPROVED'
                                                AND p.user_id <> e.host_id),
                pending_participant_count  = (SELECT COUNT(*)
                                              FROM participation p
                                              WHERE p.event_id = NEW.event_id
                                                AND p.status = 'PENDING'
                                                AND p.user_id <> e.host_id)
            WHERE e.id = NEW.event_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Backfill an internal APPROVED participation row for every host-event pair.
INSERT INTO participation (event_id, user_id, status, created_at, updated_at)
SELECT e.id, e.host_id, 'APPROVED', e.created_at, e.updated_at
FROM event e
WHERE NOT EXISTS (
    SELECT 1
    FROM participation p
    WHERE p.event_id = e.id
      AND p.user_id = e.host_id
);

-- Recompute counters so the snapshot stays aligned after the backfill.
UPDATE event e
SET approved_participant_count = (SELECT COUNT(*)
                                  FROM participation p
                                  WHERE p.event_id = e.id
                                    AND p.status = 'APPROVED'
                                    AND p.user_id <> e.host_id),
    pending_participant_count  = (SELECT COUNT(*)
                                  FROM participation p
                                  WHERE p.event_id = e.id
                                    AND p.status = 'PENDING'
                                    AND p.user_id <> e.host_id);
