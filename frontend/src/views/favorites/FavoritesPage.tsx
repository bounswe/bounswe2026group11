import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritesViewModel } from '@/viewmodels/favorites/useFavoritesViewModel';
import FavoriteLocationsTab from './FavoriteLocationsTab';
import type { FavoriteEventItem } from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { getEventCardBadgePresentation } from '@/utils/eventStatus';
import '@/styles/my-events.css';
import '@/styles/discover.css';
import '@/styles/favorites.css';

type FavoritesTab = 'events' | 'locations';

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

function FavoriteCard({ item }: { item: FavoriteEventItem }) {
  const badge = getEventCardBadgePresentation(item.status);
  const category = item.category_name ?? item.category ?? 'Event';

  return (
    <Link to={`/events/${item.id}`} className="dc-card">
      <div className="dc-card-image-wrapper">
        <EventCoverImage
          src={item.image_url}
          alt={item.title}
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
        {item.privacy_level && item.privacy_level !== 'PRIVATE' && (
          <span className={`dc-privacy-badge dc-privacy-${item.privacy_level.toLowerCase()}`}>
            {item.privacy_level === 'PUBLIC' ? 'Public' : 'Protected'}
          </span>
        )}
      </div>
      <div className="dc-card-body">
        <div className="dc-card-meta">
          <span className="dc-card-category">{category}</span>
          <span className="dc-card-date">
            {formatDate(item.start_time)} &middot; {formatTime(item.start_time)}
          </span>
        </div>
        <h3 className="dc-card-title">{item.title}</h3>
        {item.location_address && (
          <p className="dc-card-location">{item.location_address}</p>
        )}
        <div className="dc-card-footer">
          <span className="dc-card-participants">
            {item.approved_participant_count ?? 0} participant{item.approved_participant_count === 1 ? '' : 's'}
          </span>
          {item.host_score?.final_score != null && (
            <span className="dc-card-score">
              {'★'} {item.host_score.final_score.toFixed(1)}
            </span>
          )}
        </div>
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
