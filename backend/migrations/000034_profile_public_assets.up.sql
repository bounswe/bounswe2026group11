CREATE TABLE profile_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_equipment_user
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_equipment_user_id
    ON profile_equipment(user_id, created_at DESC, id DESC);

CREATE TABLE profile_showcase_image (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_showcase_image_user
        FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_showcase_image_user_id
    ON profile_showcase_image(user_id, created_at DESC, id DESC);
