-- Tear down in reverse dependency order: triggers, then tables (children before parents), then functions, then PostGIS.

DROP TRIGGER IF EXISTS trg_comment_likes ON comment_like;
DROP TRIGGER IF EXISTS trg_favorite_count ON favorite_event;
DROP TRIGGER IF EXISTS trg_participation_counts ON participation;
DROP TRIGGER IF EXISTS trg_event_tag_update ON event_tag;
DROP TRIGGER IF EXISTS trg_event_search ON event;

DROP TABLE IF EXISTS comment_like;
DROP TABLE IF EXISTS event_comment;
DROP TABLE IF EXISTS feedback;
DROP TABLE IF EXISTS ticket;
DROP TABLE IF EXISTS join_request;
DROP TABLE IF EXISTS notification;
DROP TABLE IF EXISTS invitation;
DROP TABLE IF EXISTS favorite_event;
DROP TABLE IF EXISTS participation;
DROP TABLE IF EXISTS event_constraint;
DROP TABLE IF EXISTS event_tag;
DROP TABLE IF EXISTS event_location;
DROP TABLE IF EXISTS event_history;
DROP TABLE IF EXISTS event;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS profile;
DROP TABLE IF EXISTS favorite_location;
DROP TABLE IF EXISTS category_suggestion;
DROP TABLE IF EXISTS event_category;
DROP TABLE IF EXISTS app_user;

DROP FUNCTION IF EXISTS sync_comment_likes_count();
DROP FUNCTION IF EXISTS sync_favorite_count();
DROP FUNCTION IF EXISTS sync_participation_counts();
DROP FUNCTION IF EXISTS refresh_event_tag_text();
DROP FUNCTION IF EXISTS update_event_search_vector();

DROP EXTENSION IF EXISTS postgis CASCADE;
