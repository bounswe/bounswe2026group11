import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDiscoverViewModel,
  RADIUS_OPTIONS,
  type PrivacyFilter,
} from '@/viewmodels/discover/useDiscoverViewModel';
import type { DiscoverEventItem, DiscoverSortBy } from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
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

/** Expanded wrap: above this height ⇒ multiple chip rows → show expand toggle */
const CATEGORY_MULTI_ROW_SCROLL_HEIGHT_PX = 52;

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

export default function DiscoverPage() {
  const { token } = useAuth();
  const vm = useDiscoverViewModel(token);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const categoryChipsRef = useRef<HTMLDivElement>(null);
  const [categoryChipsNeedExpand, setCategoryChipsNeedExpand] = useState(false);

  useLayoutEffect(() => {
    const el = categoryChipsRef.current;
    if (!el || vm.categories.length === 0) {
      setCategoryChipsNeedExpand(false);
      return;
    }
    const measure = () => {
      const needsSecondRow = el.scrollHeight > CATEGORY_MULTI_ROW_SCROLL_HEIGHT_PX + 1;
      setCategoryChipsNeedExpand(needsSecondRow);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [vm.categories, categoriesExpanded]);

  useLayoutEffect(() => {
    if (!categoryChipsNeedExpand && categoriesExpanded) {
      setCategoriesExpanded(false);
    }
  }, [categoryChipsNeedExpand, categoriesExpanded]);

  const hasActiveFilters =
    vm.filters.sortBy !== 'START_TIME' ||
    vm.filters.privacy !== 'ALL' ||
    vm.filters.startFrom !== '' ||
    vm.filters.startTo !== '' ||
    vm.filters.radiusMeters !== 50000 ||
    vm.filters.categoryId !== null ||
    vm.hasCustomLocationFilter;

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

  return (
    <div className="dc-page">
      <header className="dc-page-header">
        <div className="dc-page-header-text">
          <h1 className="dc-title">Discover Events</h1>
          <p className="dc-subtitle">Find events happening near you</p>
        </div>
        <div className="dc-page-header-location">
          <button
            type="button"
            className="dc-location-bar-btn"
            onClick={vm.handleLocationButtonClick}
            aria-haspopup="dialog"
            aria-expanded={vm.isLocationModalOpen}
            aria-label={`Location: ${vm.locationShortLabel}. Open location picker.`}
          >
            <MapPinIcon className="dc-location-bar-icon" />
            <span className="dc-location-bar-value">{vm.locationShortLabel}</span>
            <ChevronDownIcon className="dc-location-bar-chevron" />
          </button>
        </div>
      </header>

      {vm.showBrowserLocationPrompt && (
        <div className="dc-location-prompt" role="status">
          <p className="dc-location-prompt-text">
            Use your device location for nearby results. Safari requires tapping the button below to allow
            access.
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
            <button type="button" className="dc-location-prompt-dismiss" onClick={vm.dismissBrowserLocationPrompt}>
              Not now
            </button>
          </div>
        </div>
      )}

      <div className="dc-filters">
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
            className={`dc-filter-toggle ${filtersOpen ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <FilterIcon className="dc-filter-toggle-icon" />
            <span>
              Filters{hasActiveFilters ? ' *' : ''}
            </span>
          </button>
        </div>

        {/* Collapsible filters panel */}
        {filtersOpen && (
          <div className="dc-filter-panel">
            {/* Sort */}
            <div className="dc-filter-group">
              <label className="dc-filter-label" id="dc-discover-sort-label">
                Sort by
              </label>
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

            {/* Radius */}
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

            {/* Privacy */}
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

            {/* Date range */}
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

            {/* Clear */}
            {hasActiveFilters && (
              <button
                type="button"
                className="dc-clear-btn"
                onClick={vm.clearFilters}
              >
                Clear All Filters
              </button>
            )}
          </div>
        )}

        {/* Categories */}
        {vm.categories.length > 0 && (
          <div className="dc-category-block">
            <p
              className="dc-inline-control-label dc-category-label"
              id="dc-discover-categories-label"
            >
              Categories
            </p>
            <div className="dc-category-row-with-expand">
              <div
                ref={categoryChipsRef}
                className={`dc-category-chips ${categoryChipsNeedExpand && !categoriesExpanded ? 'dc-category-chips--collapsed' : ''}`}
                role="group"
                aria-labelledby="dc-discover-categories-label"
              >
                {vm.categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`dc-category-chip ${vm.filters.categoryId === cat.id ? 'selected' : ''}`}
                    onClick={() => vm.updateCategory(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              {categoryChipsNeedExpand && (
                <button
                  type="button"
                  className="dc-category-expand"
                  onClick={() => setCategoriesExpanded((e) => !e)}
                  aria-expanded={categoriesExpanded}
                >
                  <span>{categoriesExpanded ? 'Show less' : 'Show more'}</span>
                  <ChevronDownIcon
                    className={`dc-category-expand-chevron ${categoriesExpanded ? 'dc-category-expand-chevron--open' : ''}`}
                  />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {vm.isLocationModalOpen && (
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

            {vm.defaultProfileLocation && (
              <div className="dc-loc-modal-section">
                <p className="dc-loc-modal-section-label">Default</p>
                <button
                  type="button"
                  className={`dc-loc-modal-pill ${
                    vm.pendingLocation &&
                    vm.pendingLocation.lat === vm.defaultProfileLocation.lat &&
                    vm.pendingLocation.lon === vm.defaultProfileLocation.lon
                      ? 'selected'
                      : ''
                  }`}
                  onClick={vm.selectDefaultProfileInModal}
                >
                  <MapPinIcon className="dc-loc-modal-pill-icon" />
                  <span>{formatEventLocation(vm.defaultProfileLocation.display_name)}</span>
                </button>
              </div>
            )}

            {vm.favoriteLocations.length > 0 && (
              <div className="dc-loc-modal-section">
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
                placeholder="Search for a location"
                value={vm.modalLocationQuery}
                onChange={(e) => vm.updateModalLocationQuery(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
              />
            </div>

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
              ) : vm.modalLocationQuery.trim().length >= 2 ? (
                <p className="dc-loc-modal-hint">No locations found.</p>
              ) : vm.pendingLocation ? (
                <p className="dc-loc-modal-hint muted">Use favorites or default above, or search below.</p>
              ) : (
                <p className="dc-loc-modal-hint">Type at least 2 characters to search.</p>
              )}
            </div>

            <button type="button" className="dc-loc-modal-apply" onClick={vm.applyModalLocation}>
              {vm.modalLocationQuery.trim() === ''
                ? vm.defaultProfileLocation
                  ? 'Use default location'
                  : 'Apply'
                : 'Apply location'}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {vm.error && (
        <div className="error-banner">
          {vm.error}
          <button type="button" className="dc-retry-btn" onClick={vm.refresh}>
            Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {vm.isLoading && (
        <div className="dc-loading">
          <span className="spinner" />
          <p>Loading events...</p>
        </div>
      )}

      {/* Empty state */}
      {!vm.isLoading && !vm.error && vm.events.length === 0 && (
        <div className="dc-empty">
          <h2>No events found</h2>
          <p>Try adjusting your filters or search to find events.</p>
        </div>
      )}

      {/* Event list */}
      {!vm.isLoading && vm.events.length > 0 && (
        <>
          <div className="dc-grid">
            {vm.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>

          {/* Load more */}
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
