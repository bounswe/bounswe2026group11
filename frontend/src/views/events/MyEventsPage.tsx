import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMyEventsViewModel, type MyEventsTab } from '@/viewmodels/event/useMyEventsViewModel';
import type { EventSummary } from '@/models/profile';
import { EventCoverImage } from '@/components/EventCoverImage';
import { getEventStatusPresentation } from '@/utils/eventStatus';
import '@/styles/my-events.css';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
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

function StatusBadge({ status }: { status: string }) {
  const presentation = getEventStatusPresentation(status);
  const cls = presentation.tone === 'active'
    ? 'me-status-active'
    : presentation.tone === 'canceled'
      ? 'me-status-canceled'
      : 'me-status-completed';

  return <span className={`me-status-badge ${cls}`}>{presentation.label}</span>;
}

function EventCard({ event }: { event: EventSummary }) {
  return (
    <Link to={`/events/${event.id}`} className="me-card">
      <div className="me-card-image-wrapper">
        <EventCoverImage
          src={event.image_url}
          alt={event.title}
          imgClassName="me-card-image"
          variant="card"
        />
      </div>
      <div className="me-card-body">
        <div className="me-card-top">
          {event.category && <span className="me-card-category">{event.category}</span>}
          <StatusBadge status={event.status} />
        </div>
        <h3 className="me-card-title">{event.title}</h3>
        <p className="me-card-date">
          {formatDate(event.start_time)} &middot; {formatTime(event.start_time)}
        </p>
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
