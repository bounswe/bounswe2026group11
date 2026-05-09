ALTER TABLE event
    ADD COLUMN child_friendly  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN family_oriented BOOLEAN NOT NULL DEFAULT false;
