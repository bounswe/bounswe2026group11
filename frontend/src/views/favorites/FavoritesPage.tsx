import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritesViewModel } from '@/viewmodels/favorites/useFavoritesViewModel';
import FavoriteLocationsTab from './FavoriteLocationsTab';
import type { FavoriteEventItem } from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { getEventLifecyclePresentation, getEventStatusPresentation } from '@/utils/eventStatus';
import '@/styles/my-events.css';
import '@/styles/favorites.css';

type FavoritesTab = 'events' | 'locations';

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
  const lifecycle = getEventLifecyclePresentation(status);
  if (lifecycle) {
    const cls = lifecycle.variant === 'upcoming'
      ? 'me-status-upcoming'
      : 'me-status-in-progress';

    return <span className={`me-status-badge ${cls}`}>{lifecycle.label}</span>;
  }

  const presentation = getEventStatusPresentation(status);
  const cls = presentation.tone === 'active'
    ? 'me-status-active'
    : presentation.tone === 'canceled'
      ? 'me-status-canceled'
      : 'me-status-completed';

  return <span className={`me-status-badge ${cls}`}>{presentation.label}</span>;
}

function FavoriteCard({ item }: { item: FavoriteEventItem }) {
  return (
    <Link to={`/events/${item.id}`} className="me-card">
      <div className="me-card-image-wrapper">
        <EventCoverImage
          src={item.image_url}
          alt={item.title}
          imgClassName="me-card-image"
          variant="card"
        />
      </div>
      <div className="me-card-body">
        <div className="me-card-top">
          {item.category && <span className="me-card-category">{item.category}</span>}
          <StatusBadge status={item.status} />
        </div>
        <h3 className="me-card-title">{item.title}</h3>
        <p className="me-card-date">
          {formatDate(item.start_time)} &middot; {formatTime(item.start_time)}
        </p>
      </div>
    </Link>
  );
}

function FavoriteEventsContent({ token }: { token: string | null }) {
  const vm = useFavoritesViewModel(token);

  if (vm.isLoading) {
    return (
      <div className="me-loading">
        <span className="spinner" />
        <p>Loading your favorites...</p>
      </div>
    );
  }

  if (vm.error) {
    return (
      <div className="me-error">
        <p>{vm.error}</p>
        <button type="button" className="me-retry-btn" onClick={vm.retry}>
          Retry
        </button>
      </div>
    );
  }

  if (vm.items.length === 0) {
    return (
      <div className="me-empty">
        <p>No favorites yet. Discover events and save them for later!</p>
      </div>
    );
  }

  return (
    <div className="me-grid">
      {vm.items.map((item) => (
        <FavoriteCard key={item.id} item={item} />
      ))}
    </div>
  );
}

const TABS: { key: FavoritesTab; label: string }[] = [
  { key: 'events', label: 'Events' },
  { key: 'locations', label: 'Locations' },
];

export default function FavoritesPage() {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<FavoritesTab>('events');

  return (
    <div className="me-page">
      <h1 className="me-title">Favorites</h1>
      <p className="me-subtitle">Your saved events and locations</p>

      {/* Tabs */}
      <div className="me-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`me-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'events' && <FavoriteEventsContent token={token} />}
      {activeTab === 'locations' && <FavoriteLocationsTab />}
    </div>
  );
}
