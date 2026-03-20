-- Tear down triggers before functions (reverse of up migration).

DROP TRIGGER IF EXISTS trg_comment_likes ON comment_like;
DROP TRIGGER IF EXISTS trg_favorite_count ON favorite_event;
DROP TRIGGER IF EXISTS trg_participation_counts ON participation;
DROP TRIGGER IF EXISTS trg_event_tag_update ON event_tag;
DROP TRIGGER IF EXISTS trg_event_search ON event;

DROP FUNCTION IF EXISTS sync_comment_likes_count();
DROP FUNCTION IF EXISTS sync_favorite_count();
DROP FUNCTION IF EXISTS sync_participation_counts();
DROP FUNCTION IF EXISTS refresh_event_tag_text();
DROP FUNCTION IF EXISTS update_event_search_vector();
