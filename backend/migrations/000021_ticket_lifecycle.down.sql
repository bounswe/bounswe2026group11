DROP INDEX IF EXISTS idx_ticket_status;
DROP INDEX IF EXISTS idx_ticket_participation_id;
DROP INDEX IF EXISTS uq_ticket_participation_non_terminal;

ALTER TABLE ticket
    DROP CONSTRAINT IF EXISTS chk_ticket_status,
    DROP COLUMN IF EXISTS canceled_at,
    DROP COLUMN IF EXISTS used_at,
    DROP COLUMN IF EXISTS last_issued_qr_token_hash,
    DROP COLUMN IF EXISTS qr_token_version;

ALTER TABLE ticket
    ADD COLUMN IF NOT EXISTS qr_token TEXT;

UPDATE ticket
SET qr_token = id::text
WHERE qr_token IS NULL OR qr_token = '';

ALTER TABLE ticket
    ALTER COLUMN qr_token SET NOT NULL,
    ALTER COLUMN status DROP NOT NULL,
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN expires_at DROP NOT NULL;

CREATE UNIQUE INDEX idx_ticket_qr ON ticket (qr_token);
