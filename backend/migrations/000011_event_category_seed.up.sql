-- Canonical event categories (stable ids 1–20; labels match product UI).
-- Uses OVERRIDING SYSTEM VALUE so ids stay fixed; ON CONFLICT skips rows that already exist.
INSERT INTO event_category (id, name) OVERRIDING SYSTEM VALUE VALUES
    (1, 'Sports'),
    (2, 'Music'),
    (3, 'Education'),
    (4, 'Technology'),
    (5, 'Art'),
    (6, 'Food & Drink'),
    (7, 'Outdoors'),
    (8, 'Fitness'),
    (9, 'Networking'),
    (10, 'Gaming'),
    (11, 'Charity'),
    (12, 'Photography'),
    (13, 'Travel'),
    (14, 'Workshops'),
    (15, 'Conferences'),
    (16, 'Movies & Cinema'),
    (17, 'Theatre'),
    (18, 'Books & Literature'),
    (19, 'Wellness'),
    (20, 'Volunteering')
ON CONFLICT (id) DO NOTHING;

SELECT setval(
    pg_get_serial_sequence('event_category', 'id'),
    COALESCE((SELECT MAX(id) FROM event_category), 1)
);
