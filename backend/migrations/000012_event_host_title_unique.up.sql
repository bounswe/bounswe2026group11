ALTER TABLE event
    ADD CONSTRAINT uq_event_host_title UNIQUE (host_id, title);
