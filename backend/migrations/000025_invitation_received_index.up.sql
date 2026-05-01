CREATE INDEX IF NOT EXISTS idx_invitation_invited_status_created
    ON invitation (invited_user_id, status, created_at, id);
