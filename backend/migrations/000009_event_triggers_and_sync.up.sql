-- =========================
-- TRIGGERS
-- =========================

-- Updates the full-text search vector on event rows. Weight hierarchy:
--   A (highest) = title, B = description, C = tag text.
-- Skips the recomputation if none of the text columns actually changed.

CREATE OR REPLACE FUNCTION update_event_search_vector() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'UPDATE'
        AND NEW.title IS NOT DISTINCT FROM OLD.title
        AND NEW.description IS NOT DISTINCT FROM OLD.description
        AND NEW.tag_text IS NOT DISTINCT FROM OLD.tag_text
    THEN
        RETURN NEW;
    END IF;

    NEW.search_vector :=
            setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
            setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
            setweight(to_tsvector('simple', coalesce(NEW.tag_text, '')), 'C');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Denormalizes tag names into event.tag_text so the search trigger can
-- include them in the tsvector without joining the event_tag table.
CREATE OR REPLACE FUNCTION refresh_event_tag_text() RETURNS trigger AS
$$
DECLARE
    v_event_id UUID;
    v_tag_text TEXT;
BEGIN
    v_event_id := COALESCE(NEW.event_id, OLD.event_id);

    SELECT string_agg(name, ' ' ORDER BY name)
    INTO v_tag_text
    FROM event_tag
    WHERE event_id = v_event_id;

    UPDATE event
    SET tag_text = v_tag_text
    WHERE id = v_event_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_search
    BEFORE INSERT OR UPDATE
    ON event
    FOR EACH ROW
EXECUTE FUNCTION update_event_search_vector();

CREATE TRIGGER trg_event_tag_update
    AFTER INSERT OR UPDATE OR DELETE
    ON event_tag
    FOR EACH ROW
EXECUTE FUNCTION refresh_event_tag_text();

-- =========================
-- PARTICIPATION COUNT SYNC
-- =========================

-- Keeps event.approved_participant_count and event.pending_participant_count
-- in sync with the participation table. Handles INSERT, DELETE, and UPDATE
-- (including the case where event_id itself changes between old and new rows).
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

CREATE TRIGGER trg_participation_counts
    AFTER INSERT OR DELETE OR UPDATE OF status, event_id
    ON participation
    FOR EACH ROW
EXECUTE FUNCTION sync_participation_counts();

-- =========================
-- FAVORITE COUNT SYNC
-- =========================
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

CREATE TRIGGER trg_favorite_count
    AFTER INSERT OR DELETE OR UPDATE OF event_id
    ON favorite_event
    FOR EACH ROW
EXECUTE FUNCTION sync_favorite_count();

-- =========================
-- COMMENT LIKES COUNT SYNC
-- =========================
CREATE OR REPLACE FUNCTION sync_comment_likes_count() RETURNS trigger AS
$$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event_comment
        SET likes_count = (SELECT COUNT(*)
                           FROM comment_like
                           WHERE comment_id = OLD.comment_id)
        WHERE id = OLD.comment_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event_comment
        SET likes_count = (SELECT COUNT(*)
                           FROM comment_like
                           WHERE comment_id = NEW.comment_id)
        WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.comment_id IS DISTINCT FROM NEW.comment_id THEN
        UPDATE event_comment
        SET likes_count = (SELECT COUNT(*)
                           FROM comment_like
                           WHERE comment_id = OLD.comment_id)
        WHERE id = OLD.comment_id;
        UPDATE event_comment
        SET likes_count = (SELECT COUNT(*)
                           FROM comment_like
                           WHERE comment_id = NEW.comment_id)
        WHERE id = NEW.comment_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_likes
    AFTER INSERT OR DELETE OR UPDATE OF comment_id
    ON comment_like
    FOR EACH ROW
EXECUTE FUNCTION sync_comment_likes_count();
