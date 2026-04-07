import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyEventsViewModel, type MyEventsTab } from '@/viewmodels/event/useMyEventsViewModel';
import type { EventSummary } from '@/models/profile';
import { EventCoverImage } from '@/components/EventCoverImage';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import '@/styles/my-events.css';
import '@/styles/discover.css';

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

function EventCard({ event }: { event: EventSummary }) {
  const lifecycle = getEventLifecyclePresentation(event.status);
  const category = event.category_name ?? event.category;

  return (
    <Link to={`/events/${event.id}`} className="dc-card">
      <div className="dc-card-image-wrapper">
        <EventCoverImage
          src={event.image_url}
          alt={event.title}
          imgClassName="dc-card-image"
          variant="card"
        />
        {lifecycle && (
          <span
            className={`dc-lifecycle-badge ${
              lifecycle.variant === 'upcoming' ? 'dc-lifecycle-upcoming' : 'dc-lifecycle-in-progress'
            }`}
          >
            {lifecycle.label}
          </span>
        )}
        {event.privacy_level && event.privacy_level !== 'PRIVATE' && (
          <span className={`dc-privacy-badge dc-privacy-${event.privacy_level.toLowerCase()}`}>
            {event.privacy_level === 'PUBLIC' ? 'Public' : 'Protected'}
          </span>
        )}
      </div>
      <div className="dc-card-body">
        <div className="dc-card-meta">
          {category && <span className="dc-card-category">{category}</span>}
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
            {event.approved_participant_count ?? 0} participant{event.approved_participant_count === 1 ? '' : 's'}
          </span>
          {event.host_score?.final_score != null && (
            <span className="dc-card-score">
              {'★'} {event.host_score.final_score.toFixed(1)}
            </span>
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

const TABS: { key: MyEventsTab; label: string }[] = [
  { key: 'active', label: 'In Progress' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'organized', label: 'Hosted' },
  { key: 'past', label: 'Past' },
  { key: 'canceled', label: 'Canceled' },
];

export default function MyEventsPage() {
  const { token } = useAuth();
  const vm = useMyEventsViewModel(token);

  const counts: Record<MyEventsTab, number> = {
    organized: vm.organized.length,
    upcoming: vm.upcoming.length,
    active: vm.active.length,
    past: vm.past.length,
    canceled: vm.canceled.length,
  };

  return (
    <div className="me-page">
      <h1 className="me-title">My Events</h1>
      <p className="me-subtitle">Events you've hosted, joined, or attended</p>

      {/* Tabs */}
      <div className="me-tabs">
        {TABS.map((tab) => (
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
          <p>Loading your events...</p>
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
              emptyMessage="No events in progress right now."
            />
          )}
          {vm.activeTab === 'upcoming' && (
            <EventList
              events={vm.upcoming}
              emptyMessage="No upcoming events. Discover events to join!"
            />
          )}
          {vm.activeTab === 'organized' && (
            <EventList
              events={vm.organized}
              emptyMessage="You haven't hosted any events yet. Create your first event!"
            />
          )}
          {vm.activeTab === 'past' && (
            <EventList
              events={vm.past}
              emptyMessage="No past events yet."
            />
          )}
          {vm.activeTab === 'canceled' && (
            <EventList
              events={vm.canceled}
              emptyMessage="No canceled events."
            />
          )}
        </>
      )}
    </div>
  );
}
