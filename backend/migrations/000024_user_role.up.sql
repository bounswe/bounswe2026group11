ALTER TABLE app_user
    ADD COLUMN role TEXT NOT NULL DEFAULT 'USER';

UPDATE app_user
SET role = 'USER'
WHERE role IS NULL OR role = '';

ALTER TABLE app_user
    ADD CONSTRAINT chk_app_user_role
        CHECK (role IN ('USER', 'ADMIN'));

CREATE INDEX idx_app_user_role ON app_user (role);
