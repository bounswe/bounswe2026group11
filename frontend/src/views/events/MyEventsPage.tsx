import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useMyEventsViewModel, type MyEventsTab } from '@/viewmodels/event/useMyEventsViewModel';
import type { EventSummary } from '@/models/profile';
import { EventCoverImage } from '@/components/EventCoverImage';
import { RatingWithCount } from '@/components/RatingWithCount';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { getEventCardBadgePresentation } from '@/utils/eventStatus';
import { useTheme } from '@/contexts/ThemeContext';
import '@/styles/my-events.css';
import '@/styles/discover.css';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(i18n.resolvedLanguage, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(i18n.resolvedLanguage, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function EventCard({ event }: { event: EventSummary }) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const badge = getEventCardBadgePresentation(event.status);
  const categoryPresentation = getEventCategoryPresentation(event.category_name ?? event.category ?? 'Event', theme === 'dark');
  const participantCount = event.approved_participant_count ?? event.participants_count ?? 0;

  return (
    <Link to={`/events/${event.id}`} className="dc-card">
      <div className="dc-card-image-wrapper">
        <EventCoverImage
          src={event.image_url}
          alt={event.title}
          imgClassName="dc-card-image"
          variant="card"
        />
        {badge && (
          <span
            className={`dc-lifecycle-badge ${
              badge.variant === 'upcoming'
                ? 'dc-lifecycle-upcoming'
                : badge.variant === 'in_progress'
                  ? 'dc-lifecycle-in-progress'
                  : badge.variant === 'canceled'
                    ? 'dc-lifecycle-canceled'
                    : 'dc-lifecycle-completed'
            }`}
          >
            {badge.label}
          </span>
        )}
        {event.privacy_level && event.privacy_level !== 'PRIVATE' && (
          <span className={`dc-privacy-badge dc-privacy-${event.privacy_level.toLowerCase()}`}>
            {t(`events.privacy.${event.privacy_level}`)}
          </span>
        )}
      </div>
      <div className="dc-card-body">
        <div className="dc-card-meta">
          <span className="dc-card-category">{categoryPresentation.label}</span>
          <span className="dc-card-date">
            {formatDate(event.start_time)} &middot; {formatTime(event.start_time)}
          </span>
        </div>
        <h3 className="dc-card-title">{event.title}</h3>
        {event.location_address && (
          <p className="dc-card-location">{event.location_address}</p>
        )}
        <div className="dc-card-footer">
          <span className="dc-card-participants">
            {t('events.my_events.participants', { count: participantCount })}
          </span>
          {event.host_score && (
            <RatingWithCount
              score={event.host_score.final_score}
              count={event.host_score.hosted_event_rating_count}
              className="dc-card-score"
            />
          )}
        </div>
      </div>
    </Link>
  );
}

function EventList({ events, emptyMessage }: { events: EventSummary[]; emptyMessage: string }) {
  if (events.length === 0) {
    return (
      <div className="me-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="me-grid">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

export default function MyEventsPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const vm = useMyEventsViewModel(token);
  const tabs: { key: MyEventsTab; label: string }[] = [
    { key: 'active', label: t('events.my_events.tab_active') },
    { key: 'upcoming', label: t('events.my_events.tab_upcoming') },
    { key: 'organized', label: t('events.my_events.tab_hosted') },
    { key: 'past', label: t('events.my_events.tab_past') },
    { key: 'canceled', label: t('events.my_events.tab_canceled') },
  ];

  const counts: Record<MyEventsTab, number> = {
    organized: vm.organized.length,
    upcoming: vm.upcoming.length,
    active: vm.active.length,
    past: vm.past.length,
    canceled: vm.canceled.length,
  };

  return (
    <div className="me-page">
      <h1 className="me-title">{t('events.my_events.title')}</h1>
      <p className="me-subtitle">{t('events.my_events.subtitle')}</p>

      {/* Tabs */}
      <div className="me-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`me-tab ${vm.activeTab === tab.key ? 'active' : ''}`}
            onClick={() => vm.setActiveTab(tab.key)}
          >
            {tab.label}
            {!vm.isLoading && (
              <span className="me-tab-count">{counts[tab.key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {vm.isLoading && (
        <div className="me-loading">
          <span className="spinner" />
          <p>{t('events.my_events.loading')}</p>
        </div>
      )}

      {/* Error */}
      {vm.error && (
        <div className="me-error">
          <p>{vm.error}</p>
          <button type="button" className="me-retry-btn" onClick={vm.retry}>
            Retry
          </button>
        </div>
      )}

      {/* Content */}
      {!vm.isLoading && !vm.error && (
        <>
          {vm.activeTab === 'active' && (
            <EventList
            events={vm.active}
              emptyMessage={t('events.my_events.empty_active')}
            />
          )}
          {vm.activeTab === 'upcoming' && (
            <EventList
              events={vm.upcoming}
              emptyMessage={t('events.my_events.empty_upcoming')}
            />
          )}
          {vm.activeTab === 'organized' && (
            <EventList
              events={vm.organized}
              emptyMessage={t('events.my_events.empty_hosted')}
            />
          )}
          {vm.activeTab === 'past' && (
            <EventList
              events={vm.past}
              emptyMessage={t('events.my_events.empty_past')}
            />
          )}
          {vm.activeTab === 'canceled' && (
            <EventList
              events={vm.canceled}
              emptyMessage={t('events.my_events.empty_canceled')}
            />
          )}
        </>
      )}
    </div>
  );
}
