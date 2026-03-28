CREATE INDEX idx_event_discovery_start_time_active_visible
    ON event (start_time, id)
    WHERE status = 'ACTIVE'
      AND privacy_level IN ('PUBLIC', 'PROTECTED');
