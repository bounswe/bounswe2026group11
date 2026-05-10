import { useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useDiscoverViewMode } from '@/contexts/DiscoverViewModeContext';
import {
  useDiscoverViewModel,
  RADIUS_OPTIONS,
  type PrivacyFilter,
} from '@/viewmodels/discover/useDiscoverViewModel';
import type { DiscoverEventItem, DiscoverSortBy } from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
import DiscoverMapView from './DiscoverMapView';
import DiscoverEventSidePanel from './DiscoverEventSidePanel';
import { useTranslation } from 'react-i18next';
import '@/styles/discover.css';

const SORT_OPTIONS: { label: string; value: DiscoverSortBy; icon: 'time' | 'distance' }[] = [
  { label: 'Soonest', value: 'START_TIME', icon: 'time' },
  { label: 'Nearest', value: 'DISTANCE', icon: 'distance' },
];

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function CrosshairIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="2" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SortOptionIcon({ kind, className }: { kind: 'time' | 'distance'; className?: string }) {
  if (kind === 'time') {
    return (
      <svg
        className={className}
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>
    );
  }
  return (
    <svg
      className={className}
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** Maximum number of category chips rendered before the expand control. */
const CATEGORY_COLLAPSED_COUNT = 8;

const PRIVACY_OPTIONS: { label: string; value: PrivacyFilter }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Public', value: 'PUBLIC' },
  { label: 'Protected', value: 'PROTECTED' },
];

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

function EventCard({ event }: { event: DiscoverEventItem }) {
  const lifecycle = getEventLifecyclePresentation(event.status);

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
        <span className={`dc-privacy-badge dc-privacy-${event.privacy_level.toLowerCase()}`}>
          {event.privacy_level === 'PUBLIC' ? 'Public' : 'Protected'}
        </span>
      </div>

      <div className="dc-card-body">
        <div className="dc-card-meta">
          <span className="dc-card-category">{event.category_name}</span>
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
            {event.approved_participant_count} participant{event.approved_participant_count !== 1 ? 's' : ''}
          </span>
          {event.host_score.final_score != null && (
            <span className="dc-card-score">
              {'★'} {event.host_score.final_score.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

function MapEventListItem({
  event,
  onSelect,
  isSelected,
}: {
  event: DiscoverEventItem;
  onSelect: (id: string) => void;
  isSelected: boolean;
}) {
  return (
    <button
      type="button"
      className={`dc-list-item ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(event.id)}
    >
      <div className="dc-list-item-image">
        <EventCoverImage
          src={event.image_url}
          alt={event.title}
          imgClassName="dc-list-item-image-img"
          variant="card"
        />
      </div>
      <div className="dc-list-item-body">
        <div className="dc-list-item-category">{event.category_name}</div>
        <div className="dc-list-item-title">{event.title}</div>
        <div className="dc-list-item-meta">
          {formatDate(event.start_time)} · {formatTime(event.start_time)}
        </div>
        {event.location_address && (
          <div className="dc-list-item-address">{event.location_address}</div>
        )}
      </div>
    </button>
  );
}

export default function DiscoverPage() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const vm = useDiscoverViewModel(token);
  const { viewMode, setViewMode } = useDiscoverViewMode();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [categoryChipsNeedExpand, setCategoryChipsNeedExpand] = useState(false);

  const isMapMode = viewMode === 'map';

  useLayoutEffect(() => {
    const needsExpand = vm.categories.length > CATEGORY_COLLAPSED_COUNT;
    setCategoryChipsNeedExpand(needsExpand);
    if (!needsExpand && categoriesExpanded) {
      setCategoriesExpanded(false);
    }
  }, [vm.categories.length, categoriesExpanded]);

  // The filter button "*" / active highlight should reflect ONLY user-applied
  // filter knobs — the location selection has its own dedicated UI affordance,
  // so a default location should not paint the Filters button as "active".
  const hasActiveFilters =
    vm.filters.sortBy !== 'START_TIME' ||
    vm.filters.privacy !== 'ALL' ||
    vm.filters.startFrom !== '' ||
    vm.filters.startTo !== '' ||
    vm.filters.radiusMeters !== 50000 ||
    vm.filters.categoryId !== null;

  useEffect(() => {
    if (!vm.isLocationModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') vm.closeLocationModal();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [vm.isLocationModalOpen, vm.closeLocationModal]);

  useEffect(() => {
    if (!filterModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [filterModalOpen]);

  // Clear selection if the selected event is no longer in the loaded list
  useEffect(() => {
    if (!selectedEventId) return;
    if (!vm.events.find((e) => e.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [selectedEventId, vm.events]);

  const selectedEvent =
    selectedEventId != null
      ? vm.events.find((e) => e.id === selectedEventId) ?? null
      : null;

  const titleBlock = (
    <div className="dc-title-card">
      <h1 className="dc-title">Discover Events</h1>
      <p className="dc-subtitle">Find events happening near you</p>
    </div>
  );

  const locationButton = (
    <button
      type="button"
      className="dc-location-bar-btn dc-location-bar-btn--wide"
      onClick={vm.handleLocationButtonClick}
      aria-haspopup="dialog"
      aria-expanded={vm.isLocationModalOpen}
      aria-label={`Location: ${vm.locationShortLabel}. Open location picker.`}
    >
      <MapPinIcon className="dc-location-bar-icon" />
      <span className="dc-location-bar-value">{vm.locationShortLabel}</span>
      <ChevronDownIcon className="dc-location-bar-chevron" />
    </button>
  );

  const searchToolbar = (
    <div className="dc-search-toolbar">
      <input
        type="text"
        className="field-input dc-search"
        placeholder="Search events..."
        value={vm.filters.q}
        onChange={(e) => vm.updateSearch(e.target.value)}
      />
      <button
        type="button"
        className={`dc-filter-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
        onClick={() => setFilterModalOpen(true)}
      >
        <FilterIcon className="dc-filter-toggle-icon" />
        <span>Filters</span>
      </button>
      <span className="dc-search-bar-divider" />
      <button
        type="button"
        className={`dc-view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
        onClick={() => setViewMode('map')}
        aria-pressed={viewMode === 'map'}
      >
        <MapPinIcon />
        <span>{t('discover.mapView')}</span>
      </button>
      <button
        type="button"
        className={`dc-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
        onClick={() => setViewMode('list')}
        aria-pressed={viewMode === 'list'}
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span>{t('discover.listView')}</span>
      </button>
      {isMapMode && (
        <button
          type="button"
          className="dc-overlay-collapse-btn"
          onClick={() => setOverlayCollapsed((v) => !v)}
          aria-pressed={overlayCollapsed}
          aria-label={overlayCollapsed ? 'Expand panel' : 'Collapse panel'}
          title={overlayCollapsed ? 'Expand panel' : 'Collapse panel'}
        >
          <ChevronDownIcon
            className={`dc-overlay-collapse-icon ${
              overlayCollapsed ? 'dc-overlay-collapse-icon--up' : ''
            }`}
          />
        </button>
      )}
    </div>
  );

  const filterModal = filterModalOpen && (
    <div
      className="dc-filter-modal-overlay"
      role="presentation"
      onClick={() => setFilterModalOpen(false)}
    >
      <div
        className="dc-filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dc-filter-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dc-filter-modal-header">
          <h2 id="dc-filter-modal-title" className="dc-filter-modal-title">
            Filters
          </h2>
          <button
            type="button"
            className="dc-filter-modal-close"
            onClick={() => setFilterModalOpen(false)}
            aria-label="Close filters"
          >
            ×
          </button>
        </div>

        <div className="dc-filter-modal-body">
          <div className="dc-filter-group">
            <label className="dc-filter-label" id="dc-discover-sort-label">Sort by</label>
            <div className="dc-sort-row" role="group" aria-labelledby="dc-discover-sort-label">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`dc-sort-chip ${vm.filters.sortBy === opt.value ? 'selected' : ''}`}
                  onClick={() => vm.updateSort(opt.value)}
                >
                  <SortOptionIcon kind={opt.icon} className="dc-sort-chip-icon" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dc-filter-group">
            <label className="dc-filter-label">Radius</label>
            <div className="dc-chip-row">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`dc-filter-chip ${vm.filters.radiusMeters === opt.value ? 'selected' : ''}`}
                  onClick={() => vm.updateFilter('radiusMeters', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dc-filter-group">
            <label className="dc-filter-label">Privacy</label>
            <div className="dc-chip-row">
              {PRIVACY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`dc-filter-chip ${vm.filters.privacy === opt.value ? 'selected' : ''}`}
                  onClick={() => vm.updateFilter('privacy', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dc-filter-group">
            <label className="dc-filter-label">Date Range</label>
            <div className="dc-date-row">
              <input
                type="date"
                className="field-input dc-date-input"
                value={vm.filters.startFrom}
                onChange={(e) => vm.updateFilter('startFrom', e.target.value)}
                placeholder="From"
              />
              <span className="dc-date-sep">to</span>
              <input
                type="date"
                className="field-input dc-date-input"
                value={vm.filters.startTo}
                onChange={(e) => vm.updateFilter('startTo', e.target.value)}
                placeholder="To"
              />
            </div>
          </div>
        </div>

        <div className="dc-filter-modal-footer">
          {hasActiveFilters && (
            <button
              type="button"
              className="dc-filter-modal-clear"
              onClick={() => {
                vm.clearFilters();
              }}
            >
              Clear all
            </button>
          )}
          <button
            type="button"
            className="dc-filter-modal-apply"
            onClick={() => setFilterModalOpen(false)}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  const visibleCategories =
    categoryChipsNeedExpand && !categoriesExpanded
      ? vm.categories.slice(0, CATEGORY_COLLAPSED_COUNT)
      : vm.categories;

  const categoriesBlock = vm.categories.length > 0 && (
    <div className="dc-category-block">
      <div
        className={`dc-category-chips ${
          !categoriesExpanded ? 'dc-category-chips--collapsed' : ''
        }`}
        role="group"
        aria-label="Event categories"
      >
        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`dc-category-chip ${vm.filters.categoryId === cat.id ? 'selected' : ''}`}
            onClick={() => vm.updateCategory(cat.id)}
          >
            {cat.name}
          </button>
        ))}
        {categoryChipsNeedExpand && (
          <button
            type="button"
            className="dc-category-expand"
            onClick={() => setCategoriesExpanded((e) => !e)}
            aria-expanded={categoriesExpanded}
          >
            <ChevronDownIcon
              className={`dc-category-expand-chevron ${
                categoriesExpanded ? 'dc-category-expand-chevron--open' : ''
              }`}
            />
            <span className="sr-only">
              {categoriesExpanded ? 'Collapse categories' : 'Expand categories'}
            </span>
          </button>
        )}
      </div>
    </div>
  );

  const browserLocationPrompt = vm.showBrowserLocationPrompt && (
    <div className="dc-location-prompt" role="status">
      <p className="dc-location-prompt-text">
        Use your device location for nearby results. Safari requires tapping the button below to allow access.
      </p>
      {vm.browserLocationError && (
        <p className="dc-location-prompt-error">{vm.browserLocationError}</p>
      )}
      <div className="dc-location-prompt-actions">
        <button
          type="button"
          className="dc-location-prompt-primary"
          onClick={vm.requestBrowserLocation}
          disabled={vm.browserLocationRequestPending}
        >
          {vm.browserLocationRequestPending ? 'Requesting…' : 'Use my location'}
        </button>
        <button
          type="button"
          className="dc-location-prompt-dismiss"
          onClick={vm.dismissBrowserLocationPrompt}
        >
          Not now
        </button>
      </div>
    </div>
  );

  const eventsListUnderSearch = (
    <div className="dc-overlay-events">
      {vm.error && (
        <div className="dc-overlay-events-status dc-overlay-events-status--error">
          {vm.error}
          <button type="button" className="dc-overlay-events-retry" onClick={vm.refresh}>
            Retry
          </button>
        </div>
      )}
      {vm.isLoading ? (
        <div className="dc-overlay-events-status">
          <span className="spinner" /> Loading events…
        </div>
      ) : vm.events.length === 0 && !vm.error ? (
        <div className="dc-overlay-events-status">
          No events match your filters.
        </div>
      ) : (
        <ul className="dc-overlay-events-list">
          {vm.events.map((event) => (
            <li key={event.id}>
              <MapEventListItem
                event={event}
                onSelect={setSelectedEventId}
                isSelected={selectedEventId === event.id}
              />
            </li>
          ))}
          {vm.hasNext && (
            <li>
              <button
                type="button"
                className="dc-overlay-events-more"
                onClick={vm.loadMore}
                disabled={vm.isLoadingMore}
              >
                {vm.isLoadingMore ? <span className="spinner" /> : 'Load more'}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );

  const browserLocCurrentlyApplied =
    vm.hasBrowserLocation &&
    vm.pendingLocation?.display_name?.endsWith('(your location)') === true;

  const defaultLocCurrentlyApplied =
    !!vm.defaultProfileLocation &&
    !!vm.pendingLocation &&
    vm.pendingLocation.lat === vm.defaultProfileLocation.lat &&
    vm.pendingLocation.lon === vm.defaultProfileLocation.lon;

  const locationModal = vm.isLocationModalOpen && (
    <div
      className="dc-loc-modal-overlay"
      role="presentation"
      onClick={vm.closeLocationModal}
    >
      <div
        className="dc-loc-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dc-loc-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dc-loc-modal-header">
          <button
            type="button"
            className="dc-loc-modal-icon-btn"
            onClick={vm.closeLocationModal}
            aria-label="Close"
          >
            ×
          </button>
          <h2 id="dc-loc-modal-title" className="dc-loc-modal-title">
            Choose location
          </h2>
          {vm.defaultProfileLocation ? (
            <button
              type="button"
              className="dc-loc-modal-reset"
              onClick={vm.resetModalLocationDraft}
            >
              Reset
            </button>
          ) : (
            <span className="dc-loc-modal-header-spacer" aria-hidden />
          )}
        </div>

        <div className="dc-loc-modal-section">
          <p className="dc-loc-modal-section-label">Current location</p>
          {vm.hasBrowserLocation ? (
            <button
              type="button"
              className={`dc-loc-modal-pill ${browserLocCurrentlyApplied ? 'selected' : ''}`}
              onClick={vm.selectBrowserLocationInModal}
            >
              <CrosshairIcon className="dc-loc-modal-pill-icon" />
              <span>Use my current location</span>
            </button>
          ) : vm.browserLocationPermissionDenied ? (
            <p className="dc-loc-modal-permission">
              Location permission denied. Allow location access in your browser settings to use your
              current position.
            </p>
          ) : (
            <button
              type="button"
              className="dc-loc-modal-pill"
              onClick={vm.requestBrowserLocation}
              disabled={vm.browserLocationRequestPending}
            >
              <CrosshairIcon className="dc-loc-modal-pill-icon" />
              <span>
                {vm.browserLocationRequestPending
                  ? 'Requesting permission…'
                  : 'Need location permission'}
              </span>
            </button>
          )}
        </div>

        {vm.defaultProfileLocation && (
          <div className="dc-loc-modal-section">
            <p className="dc-loc-modal-section-label">Default</p>
            <button
              type="button"
              className={`dc-loc-modal-pill ${defaultLocCurrentlyApplied ? 'selected' : ''}`}
              onClick={vm.selectDefaultProfileInModal}
            >
              <MapPinIcon className="dc-loc-modal-pill-icon" />
              <span>{formatEventLocation(vm.defaultProfileLocation.display_name)}</span>
            </button>
          </div>
        )}

        {vm.favoriteLocations.length > 0 && (
          <div className="dc-loc-modal-section dc-loc-modal-section--favorites">
            <p className="dc-loc-modal-section-label">Favorite locations</p>
            <ul className="dc-loc-modal-fav-list">
              {vm.favoriteLocations.map((fav) => {
                const selected =
                  vm.pendingLocation != null &&
                  Number(vm.pendingLocation.lat) === fav.lat &&
                  Number(vm.pendingLocation.lon) === fav.lon;
                return (
                  <li key={fav.id}>
                    <button
                      type="button"
                      className={`dc-loc-modal-fav-item ${selected ? 'selected' : ''}`}
                      onClick={() => vm.selectFavoriteInModal(fav)}
                    >
                      <span className="dc-loc-modal-fav-name">{fav.name}</span>
                      <span className="dc-loc-modal-fav-address">{fav.address}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="dc-loc-modal-search">
          <SearchIcon className="dc-loc-modal-search-icon" />
          <input
            type="text"
            className="dc-loc-modal-input field-input"
            placeholder={t('discover.searchPlaceholder')}
            value={vm.modalLocationQuery}
            onChange={(e) => vm.updateModalLocationQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
          />
        </div>

        {(vm.modalLocationSearching ||
          vm.modalLocationResults.length > 0 ||
          vm.modalLocationQuery.trim().length >= 2) && (
          <div className="dc-loc-modal-list-wrap">
            {vm.modalLocationSearching ? (
              <p className="dc-loc-modal-hint">Searching…</p>
            ) : vm.modalLocationResults.length > 0 ? (
              <ul className="dc-loc-modal-suggestions">
                {vm.modalLocationResults.map((loc, i) => {
                  const selected =
                    vm.pendingLocation != null &&
                    vm.pendingLocation.lat === loc.lat &&
                    vm.pendingLocation.lon === loc.lon;
                  return (
                    <li key={`${loc.lat}-${loc.lon}-${i}`}>
                      <button
                        type="button"
                        className={`dc-loc-modal-suggestion ${selected ? 'selected' : ''}`}
                        onClick={() => vm.selectModalSuggestion(loc)}
                      >
                        {formatEventLocation(loc.display_name)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="dc-loc-modal-hint">No locations found.</p>
            )}
          </div>
        )}

        <button type="button" className="dc-loc-modal-apply" onClick={vm.applyModalLocation}>
          Apply
        </button>
      </div>
    </div>
  );

  if (isMapMode) {
    return (
      <div className="dc-page dc-page--map">
        <DiscoverMapView
          events={vm.events}
          isLoading={vm.isLoading}
          error={vm.error}
          center={vm.mapCenter}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onRetry={vm.refresh}
        />

        <div
          className={`dc-overlay dc-overlay-top-left ${
            overlayCollapsed ? 'dc-overlay-top-left--collapsed' : ''
          }`}
        >
          {titleBlock}
          {searchToolbar}
          {!overlayCollapsed && browserLocationPrompt}
          {!overlayCollapsed && eventsListUnderSearch}
        </div>

        {categoriesBlock && (
          <div className="dc-overlay dc-overlay-top-center">{categoriesBlock}</div>
        )}

        <div className="dc-overlay dc-overlay-top-right">{locationButton}</div>

        {selectedEvent && (
          <DiscoverEventSidePanel
            event={selectedEvent}
            onClose={() => setSelectedEventId(null)}
          />
        )}

        {locationModal}
        {filterModal}
      </div>
    );
  }

  // List view
  return (
    <div className="dc-page">
      <header className="dc-page-header">
        <div className="dc-page-header-text">
          {titleBlock}
        </div>
        <div className="dc-page-header-location">{locationButton}</div>
      </header>

      {browserLocationPrompt}

      <div className="dc-filters">
        {searchToolbar}
        {categoriesBlock}
      </div>

      {locationModal}
      {filterModal}

      {vm.error && (
        <div className="error-banner">
          {vm.error}
          <button type="button" className="dc-retry-btn" onClick={vm.refresh}>
            Retry
          </button>
        </div>
      )}

      {vm.isLoading && (
        <div className="dc-loading">
          <span className="spinner" />
          <p>Loading events...</p>
        </div>
      )}

      {!vm.isLoading && !vm.error && vm.events.length === 0 && (
        <div className="dc-empty">
          <h2>No events found</h2>
          <p>Try adjusting your filters or search to find events.</p>
        </div>
      )}

      {!vm.isLoading && vm.events.length > 0 && (
        <>
          <div className="dc-grid">
            {vm.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {vm.hasNext && (
            <div className="dc-load-more">
              <button
                type="button"
                className="dc-load-more-btn"
                onClick={vm.loadMore}
                disabled={vm.isLoadingMore}
              >
                {vm.isLoadingMore ? <span className="spinner" /> : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
