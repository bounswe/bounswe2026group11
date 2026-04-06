import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFavoritesViewModel } from '@/viewmodels/favorites/useFavoritesViewModel';
import type { FavoriteEventItem } from '@/models/event';
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

function FavoriteCard({ item }: { item: FavoriteEventItem }) {
  return (
    <Link to={`/events/${item.id}`} className="me-card">
      <div className="me-card-image-wrapper">
        {item.image_url ? (
          <img src={item.image_url} alt={item.title} className="me-card-image" />
        ) : (
          <div className="me-card-image-placeholder">
            <span>{item.category?.charAt(0) ?? 'E'}</span>
          </div>
        )}
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

export default function FavoritesPage() {
  const { token } = useAuth();
  const vm = useFavoritesViewModel(token);

  return (
    <div className="me-page">
      <h1 className="me-title">Favorites</h1>
      <p className="me-subtitle">Events you've saved for later</p>

      {vm.isLoading && (
        <div className="me-loading">
          <span className="spinner" />
          <p>Loading your favorites...</p>
        </div>
      )}

      {vm.error && (
        <div className="me-error">
          <p>{vm.error}</p>
          <button type="button" className="me-retry-btn" onClick={vm.retry}>
            Retry
          </button>
        </div>
      )}

      {!vm.isLoading && !vm.error && vm.items.length === 0 && (
        <div className="me-empty">
          <p>No favorites yet. Discover events and save them for later!</p>
        </div>
      )}

      {!vm.isLoading && !vm.error && vm.items.length > 0 && (
        <div className="me-grid">
          {vm.items.map((item) => (
            <FavoriteCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
