-- Canonical versioned event history for viewer-specific reconfirmation diffs.
-- Existing pre-migration history rows cannot be reconstructed exactly, so they
-- are populated with the current event snapshot. Future versions are exact.

UPDATE event
SET version_no = 1
WHERE version_no < 1;

ALTER TABLE event
    ALTER COLUMN version_no SET DEFAULT 1;

ALTER TABLE event
    ADD CONSTRAINT chk_event_version_no_positive CHECK (version_no >= 1);

ALTER TABLE event_history
    ADD COLUMN IF NOT EXISTS snapshot JSONB,
    ADD COLUMN IF NOT EXISTS changed_fields TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
    ADD COLUMN IF NOT EXISTS event_updated_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE event_history
    ADD CONSTRAINT fk_event_history_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES app_user (id);

WITH snapshots AS (
    SELECT
        e.id AS event_id,
        e.updated_at AS event_updated_at,
        jsonb_build_object(
            'title', e.title,
            'description', e.description,
            'image_url', e.image_url,
            'privacy_level', e.privacy_level,
            'status', e.status,
            'start_time', e.start_time,
            'end_time', e.end_time,
            'capacity', e.capacity,
            'minimum_age', e.minimum_age,
            'preferred_gender', e.preferred_gender,
            'child_friendly', e.child_friendly,
            'family_oriented', e.family_oriented,
            'category', CASE
                WHEN ec.id IS NULL THEN NULL
                ELSE jsonb_build_object('id', ec.id, 'name', ec.name)
            END,
            'location', CASE
                WHEN e.location_type = 'ROUTE' THEN jsonb_build_object(
                    'type', e.location_type,
                    'address', el.address,
                    'route_points', (
                        SELECT COALESCE(
                            jsonb_agg(jsonb_build_object('lat', ST_Y(dp.geom), 'lon', ST_X(dp.geom)) ORDER BY dp.path),
                            '[]'::jsonb
                        )
                        FROM ST_DumpPoints(el.geom::geometry) AS dp
                    )
                )
                ELSE jsonb_build_object(
                    'type', e.location_type,
                    'address', el.address,
                    'point', jsonb_build_object('lat', ST_Y(el.geom::geometry), 'lon', ST_X(el.geom::geometry)),
                    'route_points', '[]'::jsonb
                )
            END,
            'tags', (
                SELECT COALESCE(jsonb_agg(et.name ORDER BY et.name), '[]'::jsonb)
                FROM event_tag et
                WHERE et.event_id = e.id
            ),
            'constraints', (
                SELECT COALESCE(
                    jsonb_agg(jsonb_build_object('type', ect.constraint_type, 'info', ect.constraint_info) ORDER BY ect.created_at, ect.id),
                    '[]'::jsonb
                )
                FROM event_constraint ect
                WHERE ect.event_id = e.id
            )
        ) AS snapshot
    FROM event e
    JOIN event_location el ON el.event_id = e.id
    LEFT JOIN event_category ec ON ec.id = e.category_id
)
UPDATE event_history eh
SET snapshot = s.snapshot,
    event_updated_at = s.event_updated_at
FROM snapshots s
WHERE eh.event_id = s.event_id
  AND eh.snapshot IS NULL;

INSERT INTO event_history (
    event_id, host_id, title, category_id, description, start_time,
    end_time, privacy_level, status, capacity, minimum_age,
    preferred_gender, location_type, version_no, snapshot,
    changed_fields, created_by_user_id, event_updated_at, created_at, updated_at
)
SELECT
    e.id,
    e.host_id,
    e.title,
    e.category_id,
    e.description,
    e.start_time,
    e.end_time,
    e.privacy_level,
    e.status,
    e.capacity,
    e.minimum_age,
    e.preferred_gender,
    e.location_type,
    e.version_no,
    s.snapshot,
    '{}'::text[],
    NULL,
    e.updated_at,
    NOW(),
    NOW()
FROM event e
JOIN (
    SELECT
        e.id AS event_id,
        jsonb_build_object(
            'title', e.title,
            'description', e.description,
            'image_url', e.image_url,
            'privacy_level', e.privacy_level,
            'status', e.status,
            'start_time', e.start_time,
            'end_time', e.end_time,
            'capacity', e.capacity,
            'minimum_age', e.minimum_age,
            'preferred_gender', e.preferred_gender,
            'child_friendly', e.child_friendly,
            'family_oriented', e.family_oriented,
            'category', CASE
                WHEN ec.id IS NULL THEN NULL
                ELSE jsonb_build_object('id', ec.id, 'name', ec.name)
            END,
            'location', CASE
                WHEN e.location_type = 'ROUTE' THEN jsonb_build_object(
                    'type', e.location_type,
                    'address', el.address,
                    'route_points', (
                        SELECT COALESCE(
                            jsonb_agg(jsonb_build_object('lat', ST_Y(dp.geom), 'lon', ST_X(dp.geom)) ORDER BY dp.path),
                            '[]'::jsonb
                        )
                        FROM ST_DumpPoints(el.geom::geometry) AS dp
                    )
                )
                ELSE jsonb_build_object(
                    'type', e.location_type,
                    'address', el.address,
                    'point', jsonb_build_object('lat', ST_Y(el.geom::geometry), 'lon', ST_X(el.geom::geometry)),
                    'route_points', '[]'::jsonb
                )
            END,
            'tags', (
                SELECT COALESCE(jsonb_agg(et.name ORDER BY et.name), '[]'::jsonb)
                FROM event_tag et
                WHERE et.event_id = e.id
            ),
            'constraints', (
                SELECT COALESCE(
                    jsonb_agg(jsonb_build_object('type', ect.constraint_type, 'info', ect.constraint_info) ORDER BY ect.created_at, ect.id),
                    '[]'::jsonb
                )
                FROM event_constraint ect
                WHERE ect.event_id = e.id
            )
        ) AS snapshot
    FROM event e
    JOIN event_location el ON el.event_id = e.id
    LEFT JOIN event_category ec ON ec.id = e.category_id
) s ON s.event_id = e.id
ON CONFLICT (event_id, version_no) DO NOTHING;

UPDATE event_history
SET event_updated_at = updated_at
WHERE event_updated_at IS NULL;

ALTER TABLE event_history
    ALTER COLUMN snapshot SET NOT NULL,
    ALTER COLUMN event_updated_at SET NOT NULL;

UPDATE participation p
SET last_confirmed_event_version = e.version_no
FROM event e
WHERE p.event_id = e.id
  AND p.status = 'APPROVED';

UPDATE participation p
SET last_confirmed_event_version = COALESCE(
    (
        SELECT MIN(eh.version_no)
        FROM event_history eh
        WHERE eh.event_id = p.event_id
    ),
    e.version_no
)
FROM event e
WHERE p.event_id = e.id
  AND p.status = 'PENDING'
  AND p.last_confirmed_event_version IS NULL;

CREATE INDEX IF NOT EXISTS idx_event_history_event_version_desc
    ON event_history (event_id, version_no DESC);
