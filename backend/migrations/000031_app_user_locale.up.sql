ALTER TABLE app_user
    ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_app_user_locale'
          AND conrelid = 'app_user'::regclass
    ) THEN
        ALTER TABLE app_user
            ADD CONSTRAINT chk_app_user_locale CHECK (locale IN ('en', 'tr'));
    END IF;
END
$$;
