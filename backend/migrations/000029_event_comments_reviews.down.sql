DELETE FROM event_comment
WHERE comment_type = 'REVIEW';

DROP TRIGGER IF EXISTS trg_event_comment_reply_count ON event_comment;
DROP FUNCTION IF EXISTS sync_event_comment_reply_count();

DROP TRIGGER IF EXISTS trg_event_comment_parent_validate ON event_comment;
DROP FUNCTION IF EXISTS validate_event_comment_parent();

DROP INDEX IF EXISTS idx_event_comment_replies_latest;
DROP INDEX IF EXISTS idx_event_comment_collection_latest;
DROP INDEX IF EXISTS uq_event_comment_review_event_user;

ALTER TABLE event_comment
    DROP CONSTRAINT IF EXISTS chk_event_comment_type,
    DROP CONSTRAINT IF EXISTS chk_event_comment_review_shape,
    DROP CONSTRAINT IF EXISTS chk_event_comment_counts;

ALTER TABLE event_comment
    DROP COLUMN IF EXISTS reply_count,
    DROP COLUMN IF EXISTS image_url,
    DROP COLUMN IF EXISTS rating,
    DROP COLUMN IF EXISTS comment_type;
