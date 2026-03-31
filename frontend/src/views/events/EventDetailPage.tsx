import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEventDetailViewModel } from '@/viewmodels/event/useEventDetailViewModel';
import type { EventDetailResponse } from '@/models/event';
import '@/styles/event-detail.css';

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'ACTIVE' ? 'ed-status-active'
    : status === 'CANCELED' ? 'ed-status-canceled'
    : 'ed-status-completed';
  return <span className={`ed-status-badge ${cls}`}>{status}</span>;
}

function PrivacyBadge({ level }: { level: string }) {
  const label = level === 'PUBLIC' ? 'Public' : level === 'PROTECTED' ? 'Protected' : 'Private';
  return (
    <span className={`ed-privacy-badge ed-privacy-${level.toLowerCase()}`}>
      {label}
    </span>
  );
}

function EventContent({ event }: { event: EventDetailResponse }) {
  const navigate = useNavigate();

  return (
    <div className="ed-page">
      <button type="button" className="ed-back-btn" onClick={() => navigate(-1)}>
        &larr; Back
      </button>

      {/* Hero image */}
      <div className="ed-hero">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="ed-hero-image" />
        ) : (
          <div className="ed-hero-placeholder">
            <span>{event.category?.name?.charAt(0) ?? 'E'}</span>
          </div>
        )}
        <div className="ed-hero-badges">
          <StatusBadge status={event.status} />
          <PrivacyBadge level={event.privacy_level} />
        </div>
      </div>

      {/* Title & category */}
      <div className="ed-header">
        <h1 className="ed-title">{event.title}</h1>
        {event.category && (
          <span className="ed-category">{event.category.name}</span>
        )}
      </div>

      {/* Metrics row */}
      <div className="ed-metrics">
        <div className="ed-metric">
          <span className="ed-metric-value">{event.approved_participant_count}</span>
          <span className="ed-metric-label">Participant{event.approved_participant_count !== 1 ? 's' : ''}</span>
        </div>
        {event.viewer_context.is_host && (
          <div className="ed-metric">
            <span className="ed-metric-value">{event.pending_participant_count}</span>
            <span className="ed-metric-label">Pending</span>
          </div>
        )}
        <div className="ed-metric">
          <span className="ed-metric-value">{event.favorite_count}</span>
          <span className="ed-metric-label">Save{event.favorite_count !== 1 ? 's' : ''}</span>
        </div>
        {event.host_score.final_score != null && (
          <div className="ed-metric">
            <span className="ed-metric-value">{'★'} {event.host_score.final_score.toFixed(1)}</span>
            <span className="ed-metric-label">Host Score</span>
          </div>
        )}
      </div>

      {/* Info sections */}
      <div className="ed-sections">
        {/* Date & time */}
        <div className="ed-section">
          <h2 className="ed-section-title">Date & Time</h2>
          <div className="ed-info-row">
            <span className="ed-info-icon">&#128197;</span>
            <div>
              <p className="ed-info-primary">{formatDateTime(event.start_time)}</p>
              {event.end_time && (
                <p className="ed-info-secondary">
                  Until {formatDateTime(event.end_time)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="ed-section">
          <h2 className="ed-section-title">Location</h2>
          <div className="ed-info-row">
            <span className="ed-info-icon">&#128205;</span>
            <div>
              {event.location.address ? (
                <p className="ed-info-primary">{event.location.address}</p>
              ) : (
                <p className="ed-info-secondary">No address provided</p>
              )}
              <p className="ed-info-secondary">
                {event.location.type === 'ROUTE' ? 'Route-based event' : 'Point location'}
                {event.location.point && (
                  <> &middot; {event.location.point.lat.toFixed(4)}, {event.location.point.lon.toFixed(4)}</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {event.description && (
          <div className="ed-section">
            <h2 className="ed-section-title">Description</h2>
            <p className="ed-description">{event.description}</p>
          </div>
        )}

        {/* Host */}
        <div className="ed-section">
          <h2 className="ed-section-title">Host</h2>
          <div className="ed-host">
            <div className="ed-host-avatar">
              {event.host.avatar_url ? (
                <img src={event.host.avatar_url} alt={event.host.username} className="ed-avatar-img" />
              ) : (
                <span>{event.host.username.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="ed-host-info">
              <p className="ed-host-name">{event.host.display_name ?? event.host.username}</p>
              <p className="ed-host-username">@{event.host.username}</p>
            </div>
            {event.host_score.final_score != null && (
              <span className="ed-host-score">
                {'★'} {event.host_score.final_score.toFixed(1)}
                <span className="ed-host-rating-count"> ({event.host_score.hosted_event_rating_count})</span>
              </span>
            )}
          </div>
        </div>

        {/* Details grid */}
        <div className="ed-section">
          <h2 className="ed-section-title">Details</h2>
          <div className="ed-details-grid">
            {event.capacity != null && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">Capacity</span>
                <span className="ed-detail-value">{event.approved_participant_count} / {event.capacity}</span>
              </div>
            )}
            {event.minimum_age != null && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">Minimum Age</span>
                <span className="ed-detail-value">{event.minimum_age}+</span>
              </div>
            )}
            {event.preferred_gender && (
              <div className="ed-detail-item">
                <span className="ed-detail-label">Preferred Gender</span>
                <span className="ed-detail-value">{event.preferred_gender}</span>
              </div>
            )}
            <div className="ed-detail-item">
              <span className="ed-detail-label">Privacy</span>
              <span className="ed-detail-value">{event.privacy_level}</span>
            </div>
          </div>
        </div>

        {/* Tags */}
        {event.tags.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">Tags</h2>
            <div className="ed-tags">
              {event.tags.map((tag) => (
                <span key={tag} className="ed-tag">{tag}</span>
              ))}
            </div>
          </div>
        )}

        {/* Constraints */}
        {event.constraints.length > 0 && (
          <div className="ed-section">
            <h2 className="ed-section-title">Requirements</h2>
            <ul className="ed-constraints">
              {event.constraints.map((c, i) => (
                <li key={i} className="ed-constraint">
                  <span className="ed-constraint-type">{c.type}</span>
                  <span className="ed-constraint-info">{c.info}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Viewer participation status */}
        {!event.viewer_context.is_host && event.viewer_context.participation_status !== 'NONE' && (
          <div className="ed-section">
            <div className={`ed-participation-banner ed-participation-${event.viewer_context.participation_status.toLowerCase()}`}>
              {event.viewer_context.participation_status === 'JOINED' && 'You are participating in this event'}
              {event.viewer_context.participation_status === 'PENDING' && 'Your join request is pending approval'}
              {event.viewer_context.participation_status === 'INVITED' && 'You have been invited to this event'}
            </div>
          </div>
        )}

        {/* Host management section */}
        {event.viewer_context.is_host && event.host_context && (
          <div className="ed-section">
            <h2 className="ed-section-title">Management</h2>

            {/* Approved participants */}
            <div className="ed-mgmt-group">
              <h3 className="ed-mgmt-title">
                Approved Participants ({event.host_context.approved_participants.length})
              </h3>
              {event.host_context.approved_participants.length === 0 ? (
                <p className="ed-mgmt-empty">No participants yet</p>
              ) : (
                <ul className="ed-mgmt-list">
                  {event.host_context.approved_participants.map((p) => (
                    <li key={p.participation_id} className="ed-mgmt-item">
                      <div className="ed-mgmt-avatar">
                        {p.user.avatar_url ? (
                          <img src={p.user.avatar_url} alt={p.user.username} className="ed-avatar-img" />
                        ) : (
                          <span>{p.user.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="ed-mgmt-user-info">
                        <span className="ed-mgmt-name">{p.user.display_name ?? p.user.username}</span>
                        <span className="ed-mgmt-username">@{p.user.username}</span>
                      </div>
                      {p.user.final_score != null && (
                        <span className="ed-mgmt-score">{'★'} {p.user.final_score.toFixed(1)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Pending requests */}
            {event.host_context.pending_join_requests.length > 0 && (
              <div className="ed-mgmt-group">
                <h3 className="ed-mgmt-title">
                  Pending Requests ({event.host_context.pending_join_requests.length})
                </h3>
                <ul className="ed-mgmt-list">
                  {event.host_context.pending_join_requests.map((r) => (
                    <li key={r.join_request_id} className="ed-mgmt-item">
                      <div className="ed-mgmt-avatar">
                        {r.user.avatar_url ? (
                          <img src={r.user.avatar_url} alt={r.user.username} className="ed-avatar-img" />
                        ) : (
                          <span>{r.user.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="ed-mgmt-user-info">
                        <span className="ed-mgmt-name">{r.user.display_name ?? r.user.username}</span>
                        <span className="ed-mgmt-username">@{r.user.username}</span>
                        {r.message && <span className="ed-mgmt-message">"{r.message}"</span>}
                      </div>
                      <span className="ed-mgmt-date">{formatShortDate(r.created_at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Invitations */}
            {event.host_context.invitations.length > 0 && (
              <div className="ed-mgmt-group">
                <h3 className="ed-mgmt-title">
                  Invitations ({event.host_context.invitations.length})
                </h3>
                <ul className="ed-mgmt-list">
                  {event.host_context.invitations.map((inv) => (
                    <li key={inv.invitation_id} className="ed-mgmt-item">
                      <div className="ed-mgmt-avatar">
                        {inv.user.avatar_url ? (
                          <img src={inv.user.avatar_url} alt={inv.user.username} className="ed-avatar-img" />
                        ) : (
                          <span>{inv.user.username.charAt(0).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="ed-mgmt-user-info">
                        <span className="ed-mgmt-name">{inv.user.display_name ?? inv.user.username}</span>
                        <span className="ed-mgmt-username">@{inv.user.username}</span>
                      </div>
                      <span className={`ed-invitation-status ed-inv-${inv.status.toLowerCase()}`}>
                        {inv.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Rating window info */}
        {event.rating_window.is_active && (
          <div className="ed-section">
            <div className="ed-rating-banner">
              Rating window is open until {formatShortDate(event.rating_window.closes_at)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { event, status, errorMessage, retry } = useEventDetailViewModel(id, token);

  if (status === 'loading') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <span className="spinner" />
          <p>Loading event...</p>
        </div>
      </div>
    );
  }

  if (status === 'not-found') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <h2>Event Not Found</h2>
          <p>This event doesn't exist or has been removed.</p>
          <a href="/discover" className="btn-primary ed-back-link">Back to Discover</a>
        </div>
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <h2>Access Denied</h2>
          <p>You don't have permission to view this event.</p>
          <a href="/discover" className="btn-primary ed-back-link">Back to Discover</a>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="ed-page">
        <div className="ed-state-container">
          <h2>Something Went Wrong</h2>
          <p>{errorMessage}</p>
          <button type="button" className="btn-primary ed-retry-btn" onClick={retry}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!event) return null;

  return <EventContent event={event} />;
}
