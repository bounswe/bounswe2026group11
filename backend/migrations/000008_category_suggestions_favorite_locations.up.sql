-- =========================
-- CATEGORY SUGGESTION
-- =========================
CREATE TABLE category_suggestion
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    name       VARCHAR                  NOT NULL,
    user_id    UUID                     NOT NULL,
    message    TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_category_suggestion_user FOREIGN KEY (user_id) REFERENCES app_user (id)
);

-- =========================
-- FAVORITE LOCATION (POSTGIS)
-- =========================
CREATE TABLE favorite_location
(
    id         UUID PRIMARY KEY                  DEFAULT gen_random_uuid(),
    user_id    UUID                     NOT NULL,
    address    TEXT,
    point      GEOGRAPHY(POINT, 4326),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_fav_location_user FOREIGN KEY (user_id) REFERENCES app_user (id) ON DELETE CASCADE
);

CREATE INDEX idx_fav_location_user_id ON favorite_location (user_id);
CREATE INDEX idx_fav_location_point ON favorite_location USING GIST (point);
