ALTER TABLE participation
    ADD CONSTRAINT chk_participation_status
        CHECK (status IN ('APPROVED', 'PENDING', 'CANCELED', 'LEAVED'));
