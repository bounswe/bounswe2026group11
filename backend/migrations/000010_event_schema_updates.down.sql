ALTER TABLE event_constraint DROP COLUMN IF EXISTS constraint_type;

ALTER TABLE event DROP CONSTRAINT IF EXISTS chk_event_time;
UPDATE event SET end_time = start_time + INTERVAL '1 hour' WHERE end_time IS NULL;
ALTER TABLE event ALTER COLUMN end_time SET NOT NULL;
ALTER TABLE event ADD CONSTRAINT chk_event_time CHECK (start_time < end_time);
