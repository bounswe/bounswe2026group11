CREATE TABLE badge
(
    id          SMALLINT PRIMARY KEY,
    slug        TEXT     NOT NULL UNIQUE,
    name        TEXT     NOT NULL,
    description TEXT     NOT NULL,
    icon_url    TEXT,
    category    TEXT     NOT NULL,
    sort_order  SMALLINT NOT NULL DEFAULT 0,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_badge_category
        CHECK (category IN ('HOSTING', 'PARTICIPATION', 'SOCIAL'))
);

CREATE TABLE user_badge
(
    user_id   UUID                     NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    badge_id  SMALLINT                 NOT NULL REFERENCES badge (id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX idx_user_badge_user_earned ON user_badge (user_id, earned_at DESC);
CREATE INDEX idx_user_badge_badge ON user_badge (badge_id);

INSERT INTO badge (id, slug, name, description, category, sort_order)
VALUES (1, 'FIRST_STEPS', 'First Steps', 'Attend your first event.', 'PARTICIPATION', 10),
       (2, 'REGULAR', 'Regular', 'Attend 5 events.', 'PARTICIPATION', 20),
       (3, 'VETERAN', 'Veteran', 'Attend 20 events.', 'PARTICIPATION', 30),
       (4, 'EXPLORER', 'Explorer', 'Attend events in 3 different categories.', 'PARTICIPATION', 40),
       (5, 'HOST_DEBUT', 'Host Debut', 'Host your first event.', 'HOSTING', 50),
       (6, 'SUPER_HOST', 'Super Host', 'Host 10 events.', 'HOSTING', 60),
       (7, 'TOP_RATED', 'Top Rated', 'Receive an average rating of 4.5+ as a host with at least 5 ratings.', 'HOSTING', 70),
       (8, 'FAVORITE_FINDER', 'Favorite Finder', 'Save 3 favorite locations.', 'SOCIAL', 80);
