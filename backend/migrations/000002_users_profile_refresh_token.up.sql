-- =========================
-- USERS
-- =========================
CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    -- NULL when the account uses OTP-only / external IdP (no local password).
    password_hash TEXT,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    status TEXT,
    default_location_point GEOGRAPHY(POINT, 4326),
    default_location_address TEXT,
    gender TEXT,
    birth_date DATE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_app_user_default_location_point ON app_user USING GIST (default_location_point);
CREATE UNIQUE INDEX idx_app_user_phone_unique ON app_user (phone_number) WHERE phone_number IS NOT NULL;

-- =========================
-- PROFILE
-- =========================
CREATE TABLE profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

-- =========================
-- REFRESH TOKEN (access = stateless JWT, not stored)
-- =========================
-- Opaque refresh values are stored only as hashes. family_id groups a rotation chain for reuse detection.
CREATE TABLE refresh_token (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    family_id UUID NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    replaced_by_id UUID,
    device_info TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_refresh_token_replaced_by FOREIGN KEY (replaced_by_id) REFERENCES refresh_token(id) ON DELETE SET NULL
);

CREATE INDEX idx_refresh_token_user_id ON refresh_token(user_id);
CREATE INDEX idx_refresh_token_expires_at ON refresh_token(expires_at);
CREATE INDEX idx_refresh_token_family_id ON refresh_token(family_id);
CREATE INDEX idx_refresh_token_user_active ON refresh_token(user_id) WHERE revoked_at IS NULL;

-- =========================
-- OTP (email / SMS; code stored as hash only)
-- =========================
CREATE TABLE otp_challenge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    channel TEXT NOT NULL,
    destination TEXT NOT NULL,
    purpose TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    attempt_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_otp_challenge_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_otp_challenge_user_id ON otp_challenge(user_id);
CREATE INDEX idx_otp_challenge_expires_at ON otp_challenge(expires_at);
CREATE UNIQUE INDEX uq_otp_challenge_one_active ON otp_challenge (destination, purpose) WHERE consumed_at IS NULL;
