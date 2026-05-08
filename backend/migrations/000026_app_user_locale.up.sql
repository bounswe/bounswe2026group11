ALTER TABLE app_user
    ADD COLUMN locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_locale CHECK (locale IN ('en', 'tr'));
