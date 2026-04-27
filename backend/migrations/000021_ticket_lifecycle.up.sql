DROP INDEX IF EXISTS idx_ticket_qr;

ALTER TABLE ticket
    DROP COLUMN IF EXISTS qr_token,
    ADD COLUMN IF NOT EXISTS qr_token_version INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_issued_qr_token_hash TEXT,
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE ticket
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

UPDATE ticket
SET status = 'ACTIVE'
WHERE status IS NULL OR status = '';

UPDATE ticket t
SET expires_at = COALESCE(e.end_time, e.start_time + INTERVAL '60 days')
FROM participation p
JOIN event e ON e.id = p.event_id
WHERE p.id = t.participation_id
  AND t.expires_at IS NULL;

ALTER TABLE ticket
    ALTER COLUMN status SET NOT NULL,
    ALTER COLUMN status SET DEFAULT 'ACTIVE',
    ALTER COLUMN expires_at SET NOT NULL;

ALTER TABLE ticket
    ADD CONSTRAINT chk_ticket_status
        CHECK (status IN ('ACTIVE', 'PENDING', 'EXPIRED', 'USED', 'CANCELED'));

CREATE UNIQUE INDEX uq_ticket_participation_non_terminal
    ON ticket (participation_id)
    WHERE status IN ('ACTIVE', 'PENDING');

CREATE INDEX idx_ticket_participation_id ON ticket (participation_id);
CREATE INDEX idx_ticket_status ON ticket (status);
