import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EventCoverImage } from '@/components/EventCoverImage';
import { UserAvatar } from '@/components/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getEventDetail } from '@/services/eventService';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { ApiError } from '@/services/api';
import type { DiscoverEventItem, EventDetailResponse } from '@/models/event';

interface DiscoverEventSidePanelProps {
  event: DiscoverEventItem;
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatRange(startISO: string, endISO: string | null): string {
  if (!endISO) return `${formatDate(startISO)} · ${formatTime(startISO)}`;
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) {
    return `${formatDate(startISO)} · ${formatTime(startISO)} – ${formatTime(endISO)}`;
  }
  return `${formatDate(startISO)} ${formatTime(startISO)} → ${formatDate(endISO)} ${formatTime(endISO)}`;
}

function formatGender(g: string | null | undefined): string | null {
  if (!g) return null;
  const lower = g.toLowerCase();
  if (lower === 'male' || lower === 'female' || lower === 'other') {
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }
  return g;
}

export default function DiscoverEventSidePanel({
  event,
  onClose,
}: DiscoverEventSidePanelProps) {
  const { token } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    setError(null);
    setLoading(true);
    getEventDetail(event.id, token)
      .then((res) => {
        if (cancelled) return;
        setDetail(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Failed to load event details.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [event.id, token]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const title = detail?.title ?? event.title;
  const description = detail?.description ?? null;
  const imageUrl = detail?.image_url ?? event.image_url;
  const startTime = detail?.start_time ?? event.start_time;
  const endTime = detail?.end_time ?? null;
  const address = detail?.location?.address ?? event.location_address ?? null;
  const categoryName = detail?.category?.name ?? event.category_name ?? '';
  const presentation = useMemo(
    () => getEventCategoryPresentation(categoryName, isDark),
    [categoryName, isDark],
  );
  const lifecycle = getEventLifecyclePresentation(detail?.status ?? event.status);
  const approvedCount =
    detail?.approved_participant_count ?? event.approved_participant_count;
  const capacity = detail?.capacity ?? null;
  const tags = detail?.tags ?? [];
  const host = detail?.host ?? null;
  const hostName = host ? host.display_name ?? host.username : null;
  const hostScore = detail?.host_score?.final_score ?? event.host_score.final_score;
  const minAge = detail?.minimum_age ?? null;
  const preferredGender = formatGender(detail?.preferred_gender);
  const favoriteCount = detail?.favorite_count ?? null;
  const privacyLevel = detail?.privacy_level ?? event.privacy_level;
  const isApprox = detail?.location?.is_location_approximate ?? false;

  return (
    <aside
      className="dc-side-panel"
      role="dialog"
      aria-label={`Event: ${title}`}
    >
      <button
        type="button"
        className="dc-side-panel-close"
        onClick={onClose}
        aria-label="Close event preview"
      >
        ×
      </button>

      <div className="dc-side-panel-image">
        <EventCoverImage
          src={imageUrl}
          alt={title}
          imgClassName="dc-side-panel-image-img"
          variant="card"
        />
        <span
          className="dc-side-panel-category"
          style={{ background: presentation.color, color: presentation.textColor }}
        >
          <span aria-hidden>{presentation.emoji}</span>
          <span>{presentation.label}</span>
        </span>
        {lifecycle && (
          <span
            className={`dc-side-panel-lifecycle ${
              lifecycle.variant === 'upcoming'
                ? 'dc-side-panel-lifecycle-upcoming'
                : 'dc-side-panel-lifecycle-in-progress'
            }`}
          >
            {lifecycle.label}
          </span>
        )}
      </div>

      <div className="dc-side-panel-body">
        <div className="dc-side-panel-head">
          <h2 className="dc-side-panel-title">{title}</h2>
          <span
            className={`dc-side-panel-privacy dc-side-panel-privacy-${privacyLevel.toLowerCase()}`}
          >
            {privacyLevel === 'PUBLIC'
              ? 'Public'
              : privacyLevel === 'PROTECTED'
              ? 'Protected'
              : 'Private'}
          </span>
        </div>

        <ul className="dc-side-panel-facts">
          <li className="dc-side-panel-fact">
            <span className="dc-side-panel-fact-icon" aria-hidden>📅</span>
            <span>{formatRange(startTime, endTime)}</span>
          </li>
          {address && (
            <li className="dc-side-panel-fact">
              <span className="dc-side-panel-fact-icon" aria-hidden>📍</span>
              <span>
                {address}
                {isApprox && (
                  <span className="dc-side-panel-fact-note"> · approximate area</span>
                )}
              </span>
            </li>
          )}
          <li className="dc-side-panel-fact">
            <span className="dc-side-panel-fact-icon" aria-hidden>👥</span>
            <span>
              {approvedCount} going{capacity != null ? ` / ${capacity}` : ''}
            </span>
          </li>
          {(minAge != null || preferredGender) && (
            <li className="dc-side-panel-fact">
              <span className="dc-side-panel-fact-icon" aria-hidden>🛡️</span>
              <span>
                {minAge != null && <>Age {minAge}+</>}
                {minAge != null && preferredGender && ' · '}
                {preferredGender && <>{preferredGender} preferred</>}
              </span>
            </li>
          )}
          {favoriteCount != null && favoriteCount > 0 && (
            <li className="dc-side-panel-fact">
              <span className="dc-side-panel-fact-icon" aria-hidden>♥</span>
              <span>
                {favoriteCount} {favoriteCount === 1 ? 'favorite' : 'favorites'}
              </span>
            </li>
          )}
        </ul>

        {host && (
          <div className="dc-side-panel-host-row">
            <UserAvatar
              username={host.username}
              displayName={host.display_name}
              avatarUrl={host.avatar_url}
              size="sm"
              variant="muted"
            />
            <div className="dc-side-panel-host-info">
              <div className="dc-side-panel-host-name">{hostName}</div>
              {hostScore != null && (
                <div className="dc-side-panel-host-score">★ {hostScore.toFixed(1)} host score</div>
              )}
            </div>
          </div>
        )}

        {description && (
          <p className="dc-side-panel-description">{description}</p>
        )}

        {tags.length > 0 && (
          <div className="dc-side-panel-tags">
            {tags.map((tag) => (
              <span key={tag} className="dc-side-panel-tag">
                #{tag}
              </span>
            ))}
          </div>
        )}

        {loading && (
          <p className="dc-side-panel-status" role="status">
            Loading details…
          </p>
        )}
        {error && (
          <p className="dc-side-panel-status dc-side-panel-status--error" role="alert">
            {error}
          </p>
        )}

        <Link to={`/events/${event.id}`} className="dc-side-panel-cta">
          Go to event page &rarr;
        </Link>
      </div>
    </aside>
  );
}
