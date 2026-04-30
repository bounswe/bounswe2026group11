DROP INDEX IF EXISTS idx_app_user_role;

ALTER TABLE app_user
    DROP CONSTRAINT IF EXISTS chk_app_user_role;

ALTER TABLE app_user
    DROP COLUMN IF EXISTS role;
