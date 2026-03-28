-- Make end_time optional (open-ended events)
ALTER TABLE event
    ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE event
    DROP CONSTRAINT chk_event_time;
ALTER TABLE event
    ADD CONSTRAINT chk_event_time
        CHECK (end_time IS NULL OR start_time < end_time);

-- Add constraint_type to event_constraint
ALTER TABLE event_constraint
    ADD COLUMN constraint_type TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE event_constraint
    ALTER COLUMN constraint_type DROP DEFAULT;
