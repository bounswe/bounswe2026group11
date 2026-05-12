import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritesViewModel } from '@/viewmodels/favorites/useFavoritesViewModel';
import FavoriteLocationsTab from './FavoriteLocationsTab';
import type { FavoriteEventItem } from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { RatingWithCount } from '@/components/RatingWithCount';
import { getEventCardBadgePresentation } from '@/utils/eventStatus';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import '@/styles/my-events.css';
import '@/styles/discover.css';
import '@/styles/favorites.css';

type FavoritesTab = 'events' | 'locations';

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

function FavoriteCard({ item }: { item: FavoriteEventItem }) {
  const { t } = useTranslation();
  const badge = getEventCardBadgePresentation(item.status);
  const category = getEventCategoryPresentation(item.category_name ?? item.category ?? 'Event', false).label;

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
            {t(`events.privacy.${item.privacy_level}`)}
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
            {t('favorites.participants', { count: item.approved_participant_count ?? 0 })}
          </span>
          {item.host_score && (
            <RatingWithCount
              score={item.host_score.final_score}
              count={item.host_score.hosted_event_rating_count}
              className="dc-card-score"
            />
          )}
        </div>
      </div>
    </Link>
  );
}

function FavoriteEventsContent({ token }: { token: string | null }) {
  const { t } = useTranslation();
  const vm = useFavoritesViewModel(token);

  if (vm.isLoading) {
    return (
      <div className="me-loading">
        <span className="spinner" />
        <p>{t('favorites.loading_events')}</p>
      </div>
    );
  }

  if (vm.error) {
    return (
      <div className="me-error">
        <p>{vm.error}</p>
        <button type="button" className="me-retry-btn" onClick={vm.retry}>
          {t('common.retry')}
        </button>
      </div>
    );
  }

  if (vm.items.length === 0) {
    return (
      <div className="me-empty">
        <p>{t('favorites.empty_events')}</p>
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

export default function FavoritesPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<FavoritesTab>('events');
  const tabs: { key: FavoritesTab; label: string }[] = [
    { key: 'events', label: t('favorites.events_tab') },
    { key: 'locations', label: t('favorites.locations_tab') },
  ];

  return (
    <div className="me-page">
      <h1 className="me-title">{t('favorites.title')}</h1>
      <p className="me-subtitle">{t('favorites.subtitle')}</p>

      {/* Tabs */}
      <div className="me-tabs">
        {tabs.map((tab) => (
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
