-- =========================
-- EVENT HISTORY (VERSIONING)
-- =========================
CREATE TABLE event_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    host_id UUID NOT NULL,
    title TEXT,
    category_id INT,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    privacy_level TEXT NOT NULL,
    status TEXT,
    capacity INT,
    minimum_age INT,
    preferred_gender TEXT,
    location_type TEXT,
    version_no INT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_history_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_history UNIQUE (event_id, version_no)
);

CREATE INDEX idx_event_history_event_uid ON event_history(event_id);

-- =========================
-- EVENT LOCATION (POSTGIS)
-- =========================
CREATE TABLE event_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    address TEXT,
    geom GEOGRAPHY(GEOMETRY, 4326) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_location_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX idx_event_location_event_id ON event_location(event_id);
CREATE INDEX idx_event_location_geom ON event_location USING GIST(geom);

-- =========================
-- EVENT TAG
-- =========================
CREATE TABLE event_tag (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    name VARCHAR(20) NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_tag_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_tag UNIQUE (event_id, name)
);

CREATE INDEX idx_event_tag_event_id ON event_tag(event_id);

-- =========================
-- EVENT CONSTRAINT
-- =========================
CREATE TABLE event_constraint (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    constraint_info TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_constraint_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);
