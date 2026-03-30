import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDiscoverViewModel,
  RADIUS_OPTIONS,
  type PrivacyFilter,
} from '@/viewmodels/discover/useDiscoverViewModel';
import type { DiscoverEventItem, DiscoverSortBy } from '@/models/event';
import '@/styles/discover.css';

const SORT_OPTIONS: { label: string; value: DiscoverSortBy }[] = [
  { label: 'Soonest', value: 'START_TIME' },
  { label: 'Nearest', value: 'DISTANCE' },
];

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
  return (
    <a href={`/events/${event.id}`} className="dc-card">
      <div className="dc-card-image-wrapper">
        {event.image_url ? (
          <img src={event.image_url} alt={event.title} className="dc-card-image" />
        ) : (
          <div className="dc-card-image-placeholder">
            <span>{event.category_name.charAt(0)}</span>
          </div>
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
    </a>
  );
}

export default function DiscoverPage() {
  const { token } = useAuth();
  const vm = useDiscoverViewModel(token);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const hasActiveFilters =
    vm.filters.privacy !== 'ALL' ||
    vm.filters.startFrom !== '' ||
    vm.filters.startTo !== '' ||
    vm.filters.tagNames !== '' ||
    vm.filters.radiusMeters !== 50000 ||
    vm.filters.categoryId !== null ||
    (!vm.locationLabel.endsWith('(default)') && !vm.locationLabel.endsWith('(your location)'));

  if (!token) {
    return (
      <div className="dc-page">
        <h1 className="dc-title">Discover Events</h1>
        <div className="dc-login-prompt">
          <p>Sign in to discover events near you.</p>
          <a href="/login" className="btn-primary dc-login-btn">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <div className="dc-page">
      <h1 className="dc-title">Discover Events</h1>
      <p className="dc-subtitle">Find events happening near you</p>

      {/* Search */}
      <div className="dc-filters">
        <div className="dc-search-row">
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
            Filters{hasActiveFilters ? ' *' : ''}
          </button>
        </div>

        {/* Sort */}
        <div className="dc-sort-row">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`dc-sort-chip ${vm.filters.sortBy === opt.value ? 'selected' : ''}`}
              onClick={() => vm.updateSort(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Collapsible filters panel */}
        {filtersOpen && (
          <div className="dc-filter-panel">
            {/* Location */}
            <div className="dc-filter-group">
              <label className="dc-filter-label">Location</label>
              <div className="dc-location-current">
                Searching near: <strong>{vm.locationLabel}</strong>
                {!vm.locationLabel.endsWith('(default)') && !vm.locationLabel.endsWith('(your location)') && (
                  <button
                    type="button"
                    className="dc-use-my-loc"
                    onClick={vm.useMyLocation}
                  >
                    Use Istanbul, Turkey (default)
                  </button>
                )}
              </div>
              <div className="dc-location-wrapper">
                <input
                  type="text"
                  className="field-input dc-location-input"
                  placeholder="Search for a location..."
                  value={vm.locationQuery}
                  onChange={(e) => vm.handleLocationSearch(e.target.value)}
                />
                {vm.locationSearching && (
                  <div className="dc-location-searching">Searching...</div>
                )}
                {vm.locationResults.length > 0 && (
                  <ul className="dc-location-results">
                    {vm.locationResults.map((loc, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="dc-location-item"
                          onClick={() => vm.selectLocation(loc)}
                        >
                          {loc.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
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

            {/* Tags */}
            <div className="dc-filter-group">
              <label className="dc-filter-label">Tags</label>
              <input
                type="text"
                className="field-input dc-tag-input"
                placeholder="e.g. hiking, outdoor (comma-separated)"
                value={vm.filters.tagNames}
                onChange={(e) => vm.updateFilter('tagNames', e.target.value)}
              />
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
          <div className="dc-category-row">
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
        )}
      </div>

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
