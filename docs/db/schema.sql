-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- =========================
-- USERS
-- =========================
CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    phone_number TEXT,
    password_hash TEXT,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    phone_verified_at TIMESTAMP WITH TIME ZONE,
    last_login TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'active',
    role TEXT NOT NULL DEFAULT 'USER',
    locale TEXT NOT NULL DEFAULT 'en',
    default_location_point GEOGRAPHY(POINT, 4326),
    default_location_address TEXT,
    gender TEXT,
    birth_date DATE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT chk_app_user_role CHECK (role IN ('USER', 'ADMIN')),
    CONSTRAINT chk_app_user_locale CHECK (locale IN ('en', 'tr')),
    CONSTRAINT chk_app_user_status CHECK (status IN ('active', 'deactivated'))
);

CREATE INDEX idx_app_user_default_location_point ON app_user USING GIST (default_location_point);
CREATE UNIQUE INDEX idx_app_user_phone_unique ON app_user (phone_number) WHERE phone_number IS NOT NULL;
CREATE INDEX idx_app_user_role ON app_user (role);
CREATE INDEX idx_app_user_status_created ON app_user (status, created_at DESC, id DESC);

-- =========================
-- PROFILE
-- =========================
CREATE TABLE profile (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE,
    display_name TEXT,
    bio TEXT,
    avatar_url TEXT,
    avatar_version INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE TABLE profile_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_equipment_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_equipment_user_id ON profile_equipment(user_id, created_at DESC, id DESC);

CREATE TABLE profile_showcase_image (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    image_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_profile_showcase_image_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_profile_showcase_image_user_id ON profile_showcase_image(user_id, created_at DESC, id DESC);

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

-- =========================
-- CATEGORY
-- =========================
CREATE TABLE event_category (
    id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =========================
-- EVENT
-- =========================
CREATE TABLE event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID NOT NULL,
    title TEXT NOT NULL,
    category_id INT,
    description TEXT,
    image_url TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    privacy_level TEXT NOT NULL,
    status TEXT,
    capacity INT,
    approved_participant_count INT DEFAULT 0,
    pending_participant_count INT DEFAULT 0,
    favorite_count INT DEFAULT 0,
    minimum_age INT,
    preferred_gender TEXT,
    child_friendly  BOOLEAN NOT NULL DEFAULT false,
    family_oriented BOOLEAN NOT NULL DEFAULT false,
    location_type TEXT,
    image_version INT NOT NULL DEFAULT 0,
    version_no INT NOT NULL DEFAULT 1,
    canceled_approved_participant_count INT,
    tag_text TEXT,
    search_vector tsvector,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_host FOREIGN KEY (host_id) REFERENCES app_user(id),
    CONSTRAINT fk_event_category FOREIGN KEY (category_id) REFERENCES event_category(id),
    CONSTRAINT uq_event_host_title UNIQUE (host_id, title),
    CONSTRAINT chk_event_time CHECK (end_time IS NULL OR start_time < end_time),
    CONSTRAINT chk_event_version_no_positive CHECK (version_no >= 1),
    CONSTRAINT chk_event_counts CHECK (
        approved_participant_count >= 0 AND
        pending_participant_count >= 0 AND
        favorite_count >= 0
    )
);

CREATE INDEX idx_event_host_id ON event(host_id);
CREATE INDEX idx_event_category_id ON event(category_id);
CREATE INDEX idx_event_start_time ON event(start_time);
CREATE INDEX idx_event_discovery_start_time_active_visible
    ON event (start_time, id)
    WHERE status = 'ACTIVE'
      AND privacy_level IN ('PUBLIC', 'PROTECTED');
CREATE INDEX idx_event_search ON event USING GIN(search_vector);

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
    snapshot JSONB NOT NULL,
    changed_fields TEXT[] NOT NULL DEFAULT '{}',
    created_by_user_id UUID,
    event_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_history_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_history_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES app_user(id),
    CONSTRAINT uq_event_history UNIQUE (event_id, version_no)
);

CREATE INDEX idx_event_history_event_uid ON event_history(event_id);
CREATE INDEX idx_event_history_event_version_desc ON event_history(event_id, version_no DESC);

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
    constraint_type TEXT NOT NULL,
    constraint_info TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_constraint_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE
);

CREATE INDEX idx_event_constraint_event_id ON event_constraint(event_id);

-- =========================
-- PARTICIPATION
-- =========================
CREATE TABLE participation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    status TEXT NOT NULL,
    reconfirmed_at TIMESTAMP WITH TIME ZONE,
    last_confirmed_event_version INT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_participation_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_participation_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_user UNIQUE (event_id, user_id),
    CONSTRAINT chk_participation_status CHECK (status IN ('APPROVED', 'PENDING', 'CANCELED', 'LEAVED'))
);

CREATE INDEX idx_participation_event_id ON participation(event_id);
CREATE INDEX idx_participation_user_id ON participation(user_id);
CREATE INDEX idx_participation_event_status_created ON participation(event_id, status, created_at DESC);

-- =========================
-- EVENT RATING
-- =========================
CREATE TABLE event_rating (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participant_user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    rating INT NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_rating_participant FOREIGN KEY (participant_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_rating_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT uq_event_rating_participant_event UNIQUE (participant_user_id, event_id),
    CONSTRAINT chk_event_rating_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_event_rating_message CHECK (message IS NULL OR char_length(message) BETWEEN 10 AND 100)
);

CREATE INDEX idx_event_rating_event_id ON event_rating(event_id);
CREATE INDEX idx_event_rating_participant_user_id ON event_rating(participant_user_id);

-- =========================
-- PARTICIPANT RATING
-- =========================
CREATE TABLE participant_rating (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_user_id UUID NOT NULL,
    participant_user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    rating INT NOT NULL,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_participant_rating_host FOREIGN KEY (host_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_rating_participant FOREIGN KEY (participant_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_participant_rating_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT uq_participant_rating_host_participant_event UNIQUE (host_user_id, participant_user_id, event_id),
    CONSTRAINT chk_participant_rating_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_participant_rating_message CHECK (message IS NULL OR char_length(message) BETWEEN 10 AND 100)
);

CREATE INDEX idx_participant_rating_event_id ON participant_rating(event_id);
CREATE INDEX idx_participant_rating_host_user_id ON participant_rating(host_user_id);
CREATE INDEX idx_participant_rating_participant_user_id ON participant_rating(participant_user_id);

-- =========================
-- USER SCORE
-- =========================
CREATE TABLE user_score (
    user_id UUID PRIMARY KEY,
    participant_score DOUBLE PRECISION,
    participant_rating_count INT NOT NULL DEFAULT 0,
    hosted_event_score DOUBLE PRECISION,
    hosted_event_rating_count INT NOT NULL DEFAULT 0,
    final_score DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_score_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_score_counts CHECK (
        participant_rating_count >= 0 AND
        hosted_event_rating_count >= 0
    )
);

-- =========================
-- FAVORITE EVENT
-- =========================
CREATE TABLE favorite_event (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_fav_event_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_fav_event_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT uq_favorite UNIQUE (user_id, event_id)
);
CREATE INDEX idx_favorite_event_user_id ON favorite_event(user_id);
CREATE INDEX idx_favorite_event_event_id ON favorite_event(event_id);

-- =========================
-- INVITATION
-- =========================
CREATE TABLE invitation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    host_id UUID NOT NULL,
    invited_user_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_inv_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_host FOREIGN KEY (host_id) REFERENCES app_user(id),
    CONSTRAINT fk_inv_user FOREIGN KEY (invited_user_id) REFERENCES app_user(id),
    CONSTRAINT uq_invitation UNIQUE (event_id, invited_user_id)
);

CREATE INDEX idx_invitation_host_id ON invitation(host_id);
CREATE INDEX idx_invitation_invited_user_id ON invitation(invited_user_id);
CREATE INDEX idx_invitation_invited_status_created ON invitation(invited_user_id, status, created_at DESC);
CREATE INDEX idx_invitation_status_created ON invitation(status, created_at DESC, id DESC);

-- =========================
-- NOTIFICATION
-- =========================
CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID,
    receiver_user_id UUID NOT NULL,
    title TEXT NOT NULL,
    type VARCHAR,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deep_link TEXT,
    image_url TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT,
    delivery_method VARCHAR,
    status TEXT,  -- SENT, FAILED
    sent_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_notification_user FOREIGN KEY (receiver_user_id) REFERENCES app_user(id),
    CONSTRAINT fk_notification_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE SET NULL
);

CREATE INDEX idx_notification_user_id ON notification(receiver_user_id);
CREATE INDEX idx_delivery_method_and_status ON notification(delivery_method, status);
CREATE INDEX idx_notification_unread ON notification(receiver_user_id) WHERE is_read = false;
CREATE UNIQUE INDEX uq_notification_receiver_idempotency ON notification(receiver_user_id, idempotency_key);
CREATE INDEX idx_notification_user_visible_created ON notification(receiver_user_id, created_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_notification_user_unread_visible_created ON notification(receiver_user_id, created_at DESC, id DESC) WHERE deleted_at IS NULL AND is_read = false;
CREATE INDEX idx_notification_user_unread_visible ON notification(receiver_user_id) WHERE deleted_at IS NULL AND is_read = false;
CREATE INDEX idx_notification_created_at ON notification(created_at);

-- =========================
-- USER PUSH DEVICE
-- =========================
CREATE TABLE user_push_device (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    installation_id UUID NOT NULL,
    platform TEXT NOT NULL,
    fcm_token TEXT NOT NULL,
    device_info TEXT,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_user_push_device_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT chk_user_push_device_platform CHECK (platform IN ('IOS', 'ANDROID')),
    CONSTRAINT chk_user_push_device_fcm_token_nonempty CHECK (length(trim(fcm_token)) > 0)
);

CREATE UNIQUE INDEX uq_user_push_device_active_installation
    ON user_push_device(user_id, installation_id)
    WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX uq_user_push_device_active_fcm_token
    ON user_push_device(fcm_token)
    WHERE revoked_at IS NULL;
CREATE INDEX idx_user_push_device_user_active
    ON user_push_device(user_id, last_seen_at DESC)
    WHERE revoked_at IS NULL;

-- =========================
-- NOTIFICATION DELIVERY ATTEMPT
-- =========================
CREATE TABLE notification_delivery_attempt (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL,
    receiver_user_id UUID NOT NULL,
    method TEXT NOT NULL,
    status TEXT NOT NULL,
    push_device_id UUID,
    error_summary TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_notification_delivery_attempt_notification FOREIGN KEY (notification_id) REFERENCES notification(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_delivery_attempt_user FOREIGN KEY (receiver_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT fk_notification_delivery_attempt_push_device FOREIGN KEY (push_device_id) REFERENCES user_push_device(id) ON DELETE SET NULL,
    CONSTRAINT chk_notification_delivery_attempt_method CHECK (method IN ('FCM', 'SSE')),
    CONSTRAINT chk_notification_delivery_attempt_status CHECK (status IN ('SENT', 'FAILED', 'SKIPPED'))
);

CREATE INDEX idx_notification_delivery_attempt_notification ON notification_delivery_attempt(notification_id, created_at DESC);
CREATE INDEX idx_notification_delivery_attempt_user ON notification_delivery_attempt(receiver_user_id, created_at DESC);

-- =========================
-- JOIN REQUEST
-- =========================
CREATE TABLE join_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    user_id UUID NOT NULL,
    participation_id UUID,
    host_user_id UUID NOT NULL,
    status VARCHAR(50),
    message TEXT,
    image_url TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_join_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_join_user FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT fk_join_host FOREIGN KEY (host_user_id) REFERENCES app_user(id),
    CONSTRAINT uq_join UNIQUE (event_id, user_id),
    CONSTRAINT fk_join_participation FOREIGN KEY (participation_id) REFERENCES participation(id) ON DELETE SET NULL
);

CREATE INDEX idx_join_request_event_status_created ON join_request(event_id, status, created_at DESC);
CREATE INDEX idx_join_request_status_created ON join_request(status, created_at DESC, id DESC);

-- =========================
-- TICKET
-- =========================
CREATE TABLE ticket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id UUID NOT NULL,
    status VARCHAR NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    qr_token_version INTEGER NOT NULL DEFAULT 0,
    last_issued_qr_token_hash TEXT,
    used_at TIMESTAMP WITH TIME ZONE,
    canceled_at TIMESTAMP WITH TIME ZONE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_ticket_participation FOREIGN KEY (participation_id) REFERENCES participation(id) ON DELETE CASCADE,
    CONSTRAINT chk_ticket_status CHECK (status IN ('ACTIVE', 'PENDING', 'EXPIRED', 'USED', 'CANCELED'))
);

CREATE UNIQUE INDEX uq_ticket_participation_non_terminal ON ticket(participation_id) WHERE status IN ('ACTIVE', 'PENDING');
CREATE INDEX idx_ticket_participation_id ON ticket(participation_id);
CREATE INDEX idx_ticket_status ON ticket(status);

-- =========================
-- FEEDBACK
-- =========================
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    participation_id UUID NOT NULL,
    score FLOAT,
    message TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_feedback_participation FOREIGN KEY (participation_id) REFERENCES participation(id) ON DELETE CASCADE,
    CONSTRAINT chk_score CHECK (score >= 0 AND score <= 5)
);

-- =========================
-- COMMENT (TREE STRUCTURE)
-- =========================
CREATE TABLE event_comment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    event_id UUID NOT NULL,
    message TEXT NOT NULL,
    parent_id UUID,
    likes_count INT DEFAULT 0,
    comment_type TEXT NOT NULL DEFAULT 'DISCUSSION',
    rating INT,
    image_url TEXT,
    reply_count INT NOT NULL DEFAULT 0,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES app_user(id),
    CONSTRAINT fk_comment_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_parent FOREIGN KEY (parent_id) REFERENCES event_comment(id) ON DELETE CASCADE,
    CONSTRAINT chk_event_comment_counts CHECK (likes_count >= 0 AND reply_count >= 0),
    CONSTRAINT chk_event_comment_review_shape CHECK (
        (
            comment_type = 'DISCUSSION'
            AND rating IS NULL
            AND image_url IS NULL
        )
        OR (
            comment_type = 'REVIEW'
            AND parent_id IS NULL
            AND rating BETWEEN 1 AND 5
        )
    ),
    CONSTRAINT chk_event_comment_type CHECK (comment_type IN ('DISCUSSION', 'REVIEW'))
);

CREATE INDEX idx_comment_event_id ON event_comment(event_id);
CREATE UNIQUE INDEX uq_event_comment_review_event_user ON event_comment(event_id, user_id) WHERE comment_type = 'REVIEW';
CREATE INDEX idx_event_comment_collection_latest ON event_comment(event_id, comment_type, parent_id, created_at DESC, id DESC);
CREATE INDEX idx_event_comment_replies_latest ON event_comment(parent_id, created_at DESC, id DESC);

-- =========================
-- COMMENT LIKES
-- =========================
CREATE TABLE comment_like (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL,
    user_id UUID NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_like_comment FOREIGN KEY (comment_id) REFERENCES event_comment(id) ON DELETE CASCADE,
    CONSTRAINT fk_like_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT uq_comment_like UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_comment_like_comment_id ON comment_like(comment_id);

-- =========================
-- CATEGORY SUGGESTION
-- =========================
CREATE TABLE category_suggestion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR NOT NULL,
    user_id UUID NOT NULL,
    message TEXT,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_category_suggestion_user FOREIGN KEY (user_id) REFERENCES app_user(id)
);

-- =========================
-- FAVORITE LOCATION (POSTGIS)
-- =========================
CREATE TABLE favorite_location (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT,
    address TEXT,
    point GEOGRAPHY(POINT, 4326),

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_fav_location_user FOREIGN KEY (user_id) REFERENCES app_user(id) ON DELETE CASCADE
);

CREATE INDEX idx_fav_location_user_id ON favorite_location(user_id);
CREATE INDEX idx_fav_location_point ON favorite_location USING GIST(point);

-- =========================
-- EVENT REPORT
-- =========================
CREATE TABLE event_report (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    reporter_user_id UUID NOT NULL,
    report_category TEXT NOT NULL,
    message TEXT NOT NULL,
    image_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    CONSTRAINT fk_event_report_event FOREIGN KEY (event_id) REFERENCES event(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_report_reporter FOREIGN KEY (reporter_user_id) REFERENCES app_user(id) ON DELETE CASCADE,
    CONSTRAINT chk_event_report_category CHECK (
        report_category IN (
            'SAFETY',
            'HARASSMENT',
            'SPAM_OR_SCAM',
            'INAPPROPRIATE_CONTENT',
            'EVENT_NOT_AS_DESCRIBED',
            'ILLEGAL_OR_DANGEROUS',
            'OTHER'
        )
    ),
    CONSTRAINT chk_event_report_status CHECK (status IN ('PENDING', 'REVIEWED', 'DISMISSED')),
    CONSTRAINT chk_event_report_message_length CHECK (length(btrim(message)) BETWEEN 1 AND 1000)
);

CREATE INDEX idx_event_report_event_created ON event_report(event_id, created_at DESC);
CREATE INDEX idx_event_report_reporter_created ON event_report(reporter_user_id, created_at DESC);
CREATE INDEX idx_event_report_status_created ON event_report(status, created_at DESC);
CREATE INDEX idx_event_report_category_created ON event_report(report_category, created_at DESC, id DESC);

-- =========================
-- BADGE
-- =========================
CREATE TABLE badge (
    id SMALLINT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon_url TEXT,
    category TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT chk_badge_category CHECK (category IN ('HOSTING', 'PARTICIPATION', 'SOCIAL'))
);

CREATE TABLE user_badge (
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    badge_id SMALLINT NOT NULL REFERENCES badge(id) ON DELETE CASCADE,
    earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, badge_id)
);

CREATE INDEX idx_user_badge_user_earned ON user_badge(user_id, earned_at DESC);
CREATE INDEX idx_user_badge_badge ON user_badge(badge_id);

INSERT INTO badge (id, slug, name, description, category, sort_order) VALUES
    (1, 'FIRST_STEPS', 'First Steps', 'Attend your first event.', 'PARTICIPATION', 10),
    (2, 'REGULAR', 'Regular', 'Attend 5 events.', 'PARTICIPATION', 20),
    (3, 'VETERAN', 'Veteran', 'Attend 20 events.', 'PARTICIPATION', 30),
    (4, 'EXPLORER', 'Explorer', 'Attend events in 3 different categories.', 'PARTICIPATION', 40),
    (5, 'HOST_DEBUT', 'Host Debut', 'Host your first event.', 'HOSTING', 50),
    (6, 'SUPER_HOST', 'Super Host', 'Host 10 events.', 'HOSTING', 60),
    (7, 'TOP_RATED', 'Top Rated', 'Receive an average rating of 4.5+ as a host with at least 5 ratings.', 'HOSTING', 70),
    (8, 'FAVORITE_FINDER', 'Favorite Finder', 'Save 3 favorite locations.', 'SOCIAL', 80);


-- =========================
-- TRIGGERS
-- =========================

CREATE OR REPLACE FUNCTION update_event_search_vector() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
       AND NEW.title IS NOT DISTINCT FROM OLD.title
       AND NEW.description IS NOT DISTINCT FROM OLD.description
       AND NEW.tag_text IS NOT DISTINCT FROM OLD.tag_text
    THEN
        RETURN NEW;
    END IF;

    NEW.search_vector :=
        setweight(to_tsvector('simple', coalesce(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B') ||
        setweight(to_tsvector('simple', coalesce(NEW.tag_text, '')), 'C');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_event_tag_text() RETURNS trigger AS $$
DECLARE
    v_event_id UUID;
    v_tag_text TEXT;
BEGIN
    v_event_id := COALESCE(NEW.event_id, OLD.event_id);

    SELECT string_agg(name, ' ' ORDER BY name)
    INTO v_tag_text
    FROM event_tag
    WHERE event_id = v_event_id;

    UPDATE event
    SET tag_text = v_tag_text
    WHERE id = v_event_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_search
BEFORE INSERT OR UPDATE ON event
FOR EACH ROW
EXECUTE FUNCTION update_event_search_vector();

CREATE TRIGGER trg_event_tag_update
AFTER INSERT OR UPDATE OR DELETE ON event_tag
FOR EACH ROW
EXECUTE FUNCTION refresh_event_tag_text();

-- =========================
-- PARTICIPATION COUNT SYNC
-- =========================
CREATE OR REPLACE FUNCTION sync_participation_counts() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event e
        SET
            approved_participant_count = (
                SELECT COUNT(*) FROM participation p
                WHERE p.event_id = OLD.event_id
                  AND p.status = 'APPROVED'
                  AND p.user_id <> e.host_id
            ),
            pending_participant_count = (
                SELECT COUNT(*) FROM participation p
                WHERE p.event_id = OLD.event_id
                  AND p.status = 'PENDING'
                  AND p.user_id <> e.host_id
            )
        WHERE e.id = OLD.event_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event e
        SET
            approved_participant_count = (
                SELECT COUNT(*) FROM participation p
                WHERE p.event_id = NEW.event_id
                  AND p.status = 'APPROVED'
                  AND p.user_id <> e.host_id
            ),
            pending_participant_count = (
                SELECT COUNT(*) FROM participation p
                WHERE p.event_id = NEW.event_id
                  AND p.status = 'PENDING'
                  AND p.user_id <> e.host_id
            )
        WHERE e.id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.event_id IS DISTINCT FROM NEW.event_id THEN
            UPDATE event e
            SET
                approved_participant_count = (
                    SELECT COUNT(*) FROM participation p
                    WHERE p.event_id = OLD.event_id
                      AND p.status = 'APPROVED'
                      AND p.user_id <> e.host_id
                ),
                pending_participant_count = (
                    SELECT COUNT(*) FROM participation p
                    WHERE p.event_id = OLD.event_id
                      AND p.status = 'PENDING'
                      AND p.user_id <> e.host_id
                )
            WHERE e.id = OLD.event_id;
            UPDATE event e
            SET
                approved_participant_count = (
                    SELECT COUNT(*) FROM participation p
                    WHERE p.event_id = NEW.event_id
                      AND p.status = 'APPROVED'
                      AND p.user_id <> e.host_id
                ),
                pending_participant_count = (
                    SELECT COUNT(*) FROM participation p
                    WHERE p.event_id = NEW.event_id
                      AND p.status = 'PENDING'
                      AND p.user_id <> e.host_id
                )
            WHERE e.id = NEW.event_id;
        ELSE
            UPDATE event e
            SET
                approved_participant_count = (
                    SELECT COUNT(*) FROM participation p
                    WHERE p.event_id = NEW.event_id
                      AND p.status = 'APPROVED'
                      AND p.user_id <> e.host_id
                ),
                pending_participant_count = (
                    SELECT COUNT(*) FROM participation p
                    WHERE p.event_id = NEW.event_id
                      AND p.status = 'PENDING'
                      AND p.user_id <> e.host_id
                )
            WHERE e.id = NEW.event_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_participation_counts
AFTER INSERT OR DELETE OR UPDATE OF status, event_id ON participation
FOR EACH ROW
EXECUTE FUNCTION sync_participation_counts();

-- =========================
-- FAVORITE COUNT SYNC
-- =========================
CREATE OR REPLACE FUNCTION sync_favorite_count() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event
        SET favorite_count = (
            SELECT COUNT(*) FROM favorite_event
            WHERE event_id = OLD.event_id
        )
        WHERE id = OLD.event_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event
        SET favorite_count = (
            SELECT COUNT(*) FROM favorite_event
            WHERE event_id = NEW.event_id
        )
        WHERE id = NEW.event_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.event_id IS DISTINCT FROM NEW.event_id THEN
        UPDATE event
        SET favorite_count = (
            SELECT COUNT(*) FROM favorite_event
            WHERE event_id = OLD.event_id
        )
        WHERE id = OLD.event_id;
        UPDATE event
        SET favorite_count = (
            SELECT COUNT(*) FROM favorite_event
            WHERE event_id = NEW.event_id
        )
        WHERE id = NEW.event_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_favorite_count
AFTER INSERT OR DELETE OR UPDATE OF event_id ON favorite_event
FOR EACH ROW
EXECUTE FUNCTION sync_favorite_count();

-- =========================
-- COMMENT LIKES COUNT SYNC
-- =========================
CREATE OR REPLACE FUNCTION sync_comment_likes_count() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE event_comment
        SET likes_count = (
            SELECT COUNT(*) FROM comment_like
            WHERE comment_id = OLD.comment_id
        )
        WHERE id = OLD.comment_id;
    ELSIF TG_OP = 'INSERT' THEN
        UPDATE event_comment
        SET likes_count = (
            SELECT COUNT(*) FROM comment_like
            WHERE comment_id = NEW.comment_id
        )
        WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.comment_id IS DISTINCT FROM NEW.comment_id THEN
        UPDATE event_comment
        SET likes_count = (
            SELECT COUNT(*) FROM comment_like
            WHERE comment_id = OLD.comment_id
        )
        WHERE id = OLD.comment_id;
        UPDATE event_comment
        SET likes_count = (
            SELECT COUNT(*) FROM comment_like
            WHERE comment_id = NEW.comment_id
        )
        WHERE id = NEW.comment_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_comment_likes
AFTER INSERT OR DELETE OR UPDATE OF comment_id ON comment_like
FOR EACH ROW
EXECUTE FUNCTION sync_comment_likes_count();

-- =========================
-- COMMENT PARENT VALIDATION AND REPLY COUNT SYNC
-- =========================
CREATE OR REPLACE FUNCTION validate_event_comment_parent() RETURNS trigger AS $$
DECLARE
    parent_event_id UUID;
    parent_type TEXT;
    parent_parent_id UUID;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT event_id, comment_type, parent_id
    INTO parent_event_id, parent_type, parent_parent_id
    FROM event_comment
    WHERE id = NEW.parent_id;

    IF parent_event_id IS NULL THEN
        RAISE EXCEPTION 'comment parent does not exist';
    END IF;
    IF parent_event_id IS DISTINCT FROM NEW.event_id THEN
        RAISE EXCEPTION 'comment parent must belong to same event';
    END IF;
    IF parent_type <> 'DISCUSSION' THEN
        RAISE EXCEPTION 'comment parent must be a discussion comment';
    END IF;
    IF parent_parent_id IS NOT NULL THEN
        RAISE EXCEPTION 'nested replies are not supported';
    END IF;
    IF NEW.comment_type <> 'DISCUSSION' THEN
        RAISE EXCEPTION 'only discussion comments can be replies';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_comment_parent_validate
BEFORE INSERT OR UPDATE OF event_id, parent_id, comment_type ON event_comment
FOR EACH ROW
EXECUTE FUNCTION validate_event_comment_parent();

CREATE OR REPLACE FUNCTION sync_event_comment_reply_count() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*) FROM event_comment
                WHERE parent_id = OLD.parent_id
            )
            WHERE id = OLD.parent_id;
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*) FROM event_comment
                WHERE parent_id = NEW.parent_id
            )
            WHERE id = NEW.parent_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*) FROM event_comment
                WHERE parent_id = OLD.parent_id
            )
            WHERE id = OLD.parent_id;
        END IF;
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE event_comment
            SET reply_count = (
                SELECT COUNT(*) FROM event_comment
                WHERE parent_id = NEW.parent_id
            )
            WHERE id = NEW.parent_id;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_event_comment_reply_count
AFTER INSERT OR DELETE OR UPDATE OF parent_id ON event_comment
FOR EACH ROW
EXECUTE FUNCTION sync_event_comment_reply_count();
