import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useDiscoverViewMode } from '@/contexts/DiscoverViewModeContext';
import {
  useDiscoverViewModel,
  MINIMUM_AGE_OPTIONS,
  RADIUS_OPTIONS,
  type PrivacyFilter,
} from '@/viewmodels/discover/useDiscoverViewModel';
import type { DiscoverEventItem, DiscoverSortBy } from '@/models/event';
import { EventCoverImage } from '@/components/EventCoverImage';
import { RatingWithCount } from '@/components/RatingWithCount';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
import DiscoverMapView from './DiscoverMapView';
import DiscoverEventSidePanel from './DiscoverEventSidePanel';
import '@/styles/discover.css';

interface DiscoverWeatherSummary {
  temperatureC: number;
  weatherCode: number;
  isDay: boolean;
}

function CalendarIcon({ className }: { className?: string }) {
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
      <rect x="3" y="4" width="18" height="18" rx="3" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function WeatherGlyph({
  kind,
  className,
}: {
  kind: 'CLEAR' | 'CLOUD' | 'RAIN' | 'SNOW' | 'STORM' | 'FOG';
  className?: string;
}) {
  if (kind === 'CLEAR') {
    return (
      <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="4.5" fill="currentColor" />
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9 5.3 5.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'RAIN' || kind === 'STORM') {
    return (
      <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M7.5 16.5h9a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.4 1.4A3.4 3.4 0 0 0 7.5 16.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {kind === 'STORM' ? (
          <path d="m12.5 13-2 4h3l-2 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M8 19.5 7 21M12 19.5 11 21M16 19.5 15 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        )}
      </svg>
    );
  }
  if (kind === 'SNOW') {
    return (
      <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 4v16M5.1 8l13.8 8M18.9 8 5.1 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2" fill="currentColor" />
      </svg>
    );
  }
  if (kind === 'FOG') {
    return (
      <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 9h14M3 13h18M5 17h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={className} width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7.5 16.5h9a4 4 0 0 0 .5-8 5.5 5.5 0 0 0-10.4 1.4A3.4 3.4 0 0 0 7.5 16.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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

function getWeatherKind(code: number): 'CLEAR' | 'CLOUD' | 'RAIN' | 'SNOW' | 'STORM' | 'FOG' {
  if (code === 0) return 'CLEAR';
  if (code === 45 || code === 48) return 'FOG';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'RAIN';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'SNOW';
  if (code >= 95) return 'STORM';
  return 'CLOUD';
}

function getTodayLabel(): string {
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date());
}

async function fetchDiscoverWeather(
  lat: number,
  lon: number,
  signal: AbortSignal,
): Promise<DiscoverWeatherSummary> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code,is_day',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { signal });
  if (!response.ok) {
    throw new Error('Weather unavailable');
  }
  const payload = (await response.json()) as {
    current?: {
      temperature_2m?: number;
      weather_code?: number;
      is_day?: number;
    };
  };
  const current = payload.current;
  if (
    !current ||
    typeof current.temperature_2m !== 'number' ||
    typeof current.weather_code !== 'number'
  ) {
    throw new Error('Weather unavailable');
  }
  return {
    temperatureC: current.temperature_2m,
    weatherCode: current.weather_code,
    isDay: current.is_day !== 0,
  };
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

type AudienceFilterKey = 'childFriendly' | 'familyOriented';

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

function EventCard({ event }: { event: DiscoverEventItem }) {
  const { t } = useTranslation();
  const lifecycle = getEventLifecyclePresentation(event.status);
  const category = getEventCategoryPresentation(event.category_name ?? 'Event', false).label;

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
          {t(`events.privacy.${event.privacy_level}`)}
        </span>
      </div>

      <div className="dc-card-body">
        <div className="dc-card-meta">
          <span className="dc-card-category">{category}</span>
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
            {t('events.my_events.participants', { count: event.approved_participant_count })}
          </span>
          <RatingWithCount
            score={event.host_score.final_score}
            count={event.host_score.hosted_event_rating_count}
            className="dc-card-score"
          />
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
  const category = getEventCategoryPresentation(event.category_name ?? 'Event', false).label;
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
        <div className="dc-list-item-category">{category}</div>
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
  const sortOptions: { label: string; value: DiscoverSortBy; icon: 'time' | 'distance' }[] = [
    { label: t('home.sort_soonest'), value: 'START_TIME', icon: 'time' },
    { label: t('home.sort_nearest'), value: 'DISTANCE', icon: 'distance' },
  ];
  const privacyOptions: { label: string; value: PrivacyFilter }[] = [
    { label: t('common.all', 'All'), value: 'ALL' },
    { label: t('events.privacy.PUBLIC'), value: 'PUBLIC' },
    { label: t('events.privacy.PROTECTED'), value: 'PROTECTED' },
  ];
  const audienceFilterOptions: { label: string; value: AudienceFilterKey }[] = [
    { label: t('home.child_friendly'), value: 'childFriendly' },
    { label: t('home.family_oriented'), value: 'familyOriented' },
  ];
  const { viewMode } = useDiscoverViewMode();
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  const [categoriesExpanded, setCategoriesExpanded] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [categoryChipsNeedExpand, setCategoryChipsNeedExpand] = useState(false);
  const [isChoosingMapLocation, setIsChoosingMapLocation] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState<DiscoverWeatherSummary | null>(null);

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
    vm.filters.minimumAge !== null ||
    vm.filters.categoryIds.length > 0 ||
    vm.filters.childFriendly ||
    vm.filters.familyOriented;

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

  useEffect(() => {
    if (!isMapMode && isChoosingMapLocation) {
      setIsChoosingMapLocation(false);
    }
  }, [isChoosingMapLocation, isMapMode]);

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

  useEffect(() => {
    const controller = new AbortController();
    setWeatherSummary(null);
    void fetchDiscoverWeather(vm.mapCenter.lat, vm.mapCenter.lon, controller.signal)
      .then(setWeatherSummary)
      .catch(() => {
        if (!controller.signal.aborted) {
          setWeatherSummary(null);
        }
      });
    return () => {
      controller.abort();
    };
  }, [vm.mapCenter.lat, vm.mapCenter.lon]);

  const handleChooseMapLocation = useCallback(
    (lat: number, lon: number) => {
      void vm.selectMapLocation(lat, lon);
      setSelectedEventId(null);
      setIsChoosingMapLocation(false);
    },
    [vm],
  );

  const titleWeatherKind = weatherSummary ? getWeatherKind(weatherSummary.weatherCode) : null;

  const titleBlock = (
    <div className="dc-title-card">
      <div className="dc-title-card-copy">
        <h1 className="dc-title">{t('home.title')}</h1>
        <p className="dc-subtitle">{t('home.subtitle')}</p>
      </div>
      <div className="dc-title-card-meta" aria-label={weatherSummary ? t('home.current_weather') : t('home.today')}>
        {weatherSummary && titleWeatherKind ? (
          <>
            <WeatherGlyph
              kind={titleWeatherKind}
              className={`dc-title-card-meta-icon dc-title-card-meta-icon--weather dc-title-card-meta-icon--${titleWeatherKind.toLowerCase()}`}
            />
            <span className="dc-title-card-meta-primary">
              {Math.round(weatherSummary.temperatureC)}°
            </span>
          </>
        ) : (
          <>
            <CalendarIcon className="dc-title-card-meta-icon" />
            <span className="dc-title-card-meta-primary">{getTodayLabel()}</span>
          </>
        )}
      </div>
    </div>
  );

  const locationButton = isMapMode ? (
    <div className="dc-map-location-controls">
      <button
        type="button"
        className="dc-location-bar-btn dc-location-bar-btn--wide"
        onClick={vm.handleLocationButtonClick}
        aria-haspopup="dialog"
        aria-expanded={vm.isLocationModalOpen}
        aria-label={t('home.location_picker_aria', { location: vm.locationShortLabel })}
      >
        <MapPinIcon className="dc-location-bar-icon" />
        <span className="dc-location-bar-value">{vm.locationShortLabel}</span>
        <ChevronDownIcon className="dc-location-bar-chevron" />
      </button>
      <div className="dc-map-location-actions">
        <button
          type="button"
          className={`dc-map-pick-location-btn ${isChoosingMapLocation ? 'selected' : ''}`}
          onClick={() => {
            setSelectedEventId(null);
            setIsChoosingMapLocation((value) => !value);
          }}
          aria-pressed={isChoosingMapLocation}
        >
          <CrosshairIcon className="dc-map-pick-location-icon" />
          <span>
            {isChoosingMapLocation ? t('home.click_map_to_choose') : t('home.choose_location_from_map')}
          </span>
        </button>
        <label className="dc-map-radius-control">
          <span className="dc-map-radius-label">{t('home.radius')}</span>
          <input
            type="range"
            min={1000}
            max={50000}
            step={1000}
            value={vm.filters.radiusMeters}
            onChange={(e) => vm.updateFilter('radiusMeters', Number(e.target.value))}
            aria-label={t('home.discovery_radius')}
          />
          <span className="dc-map-radius-value">
            {Math.round(vm.filters.radiusMeters / 1000)} km
          </span>
        </label>
      </div>
    </div>
  ) : (
    <button
      type="button"
      className="dc-location-bar-btn dc-location-bar-btn--wide"
      onClick={vm.handleLocationButtonClick}
      aria-haspopup="dialog"
      aria-expanded={vm.isLocationModalOpen}
      aria-label={t('home.location_picker_aria', { location: vm.locationShortLabel })}
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
        placeholder={t('home.search_placeholder')}
        value={vm.filters.q}
        onChange={(e) => vm.updateSearch(e.target.value)}
      />
      <button
        type="button"
        className={`dc-filter-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
        onClick={() => setFilterModalOpen(true)}
      >
        <FilterIcon className="dc-filter-toggle-icon" />
        <span>{t('home.filters')}</span>
      </button>
      {isMapMode && (
        <button
          type="button"
          className="dc-overlay-collapse-btn"
          onClick={() => setOverlayCollapsed((v) => !v)}
          aria-pressed={overlayCollapsed}
          aria-label={overlayCollapsed ? t('home.expand_panel') : t('home.collapse_panel')}
          title={overlayCollapsed ? t('home.expand_panel') : t('home.collapse_panel')}
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
            {t('home.filters')}
          </h2>
          <button
            type="button"
            className="dc-filter-modal-close"
            onClick={() => setFilterModalOpen(false)}
            aria-label={t('home.close_filters')}
          >
            ×
          </button>
        </div>

        <div className="dc-filter-modal-body">
          <div className="dc-filter-group">
            <label className="dc-filter-label" id="dc-discover-sort-label">{t('home.sort_by')}</label>
            <div className="dc-sort-row" role="group" aria-labelledby="dc-discover-sort-label">
              {sortOptions.map((opt) => (
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
            <label className="dc-filter-label">{t('home.radius')}</label>
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
            <label className="dc-filter-label">{t('home.event_age_restriction')}</label>
            <div className="dc-chip-row">
              {MINIMUM_AGE_OPTIONS.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`dc-filter-chip ${vm.filters.minimumAge === opt.value ? 'selected' : ''}`}
                  onClick={() => vm.updateFilter('minimumAge', opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="dc-filter-group">
            <label className="dc-filter-label">{t('home.privacy')}</label>
            <div className="dc-chip-row">
              {privacyOptions.map((opt) => (
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
            <label className="dc-filter-label" id="dc-audience-filter-label">{t('home.audience')}</label>
            <div className="dc-audience-filter-grid" role="group" aria-labelledby="dc-audience-filter-label">
              {audienceFilterOptions.map((opt) => {
                const selected = vm.filters[opt.value];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    className={`dc-filter-chip dc-audience-filter-chip ${selected ? 'selected' : ''}`}
                    aria-pressed={selected}
                    onClick={() => vm.updateFilter(opt.value, !selected)}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="dc-filter-group">
            <label className="dc-filter-label">{t('discover.date_range', 'Date Range')}</label>
            <div className="dc-date-row">
              <input
                type="date"
                className="field-input dc-date-input"
                value={vm.filters.startFrom}
                onChange={(e) => vm.updateFilter('startFrom', e.target.value)}
                placeholder={t('discover.from', 'From')}
              />
              <span className="dc-date-sep">{t('discover.to', 'to')}</span>
              <input
                type="date"
                className="field-input dc-date-input"
                value={vm.filters.startTo}
                onChange={(e) => vm.updateFilter('startTo', e.target.value)}
                placeholder={t('discover.to_capital', 'To')}
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
              {t('discover.clear_all', 'Clear all')}
            </button>
          )}
          <button
            type="button"
            className="dc-filter-modal-apply"
            onClick={() => setFilterModalOpen(false)}
          >
            {t('discover.done', 'Done')}
          </button>
        </div>
      </div>
    </div>
  );

  let visibleCategories = vm.categories;
  if (categoryChipsNeedExpand && !categoriesExpanded) {
    const selectedIds = new Set(vm.filters.categoryIds);
    const selected = vm.categories.filter((c) => selectedIds.has(c.id));
    const unselected = vm.categories.filter((c) => !selectedIds.has(c.id));
    visibleCategories = [...selected, ...unselected].slice(
      0,
      Math.max(CATEGORY_COLLAPSED_COUNT, selected.length)
    );
  }

  const categoriesBlock = vm.categories.length > 0 && (
    <div className="dc-category-block">
      <div
        className={`dc-category-chips ${
          !categoriesExpanded ? 'dc-category-chips--collapsed' : ''
        }`}
        role="group"
        aria-label={t('discover.event_categories', 'Event categories')}
      >
        {visibleCategories.map((cat) => {
          const isSelected = vm.filters.categoryIds.includes(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              className={`dc-category-chip ${isSelected ? 'selected' : ''}`}
              onClick={() => vm.updateCategory(cat.id)}
            >
              {cat.name}
              {isSelected && (
                <span className="dc-category-chip-remove" aria-hidden="true" style={{ marginLeft: '4px' }}>
                  ×
                </span>
              )}
            </button>
          );
        })}
        {vm.filters.categoryIds.length > 0 && (
          <button
            type="button"
            className="dc-category-chip"
            style={{ fontWeight: 600 }}
            onClick={() => vm.updateFilter('categoryIds', [])}
          >
            {t('discover.clear_categories', 'Clear categories')}
          </button>
        )}
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
              {categoriesExpanded ? t('discover.collapse_categories', 'Collapse categories') : t('discover.expand_categories', 'Expand categories')}
            </span>
          </button>
        )}
      </div>
    </div>
  );

  const activeAudienceChips = (vm.filters.childFriendly || vm.filters.familyOriented) && (
    <div className="dc-active-filter-row" aria-label={t('discover.active_audience_filters', 'Active audience filters')}>
      {vm.filters.childFriendly && (
        <button
          type="button"
          className="dc-active-filter-chip"
          onClick={() => vm.updateFilter('childFriendly', false)}
        >
          {t('home.child_friendly')} <span aria-hidden="true">×</span>
        </button>
      )}
      {vm.filters.familyOriented && (
        <button
          type="button"
          className="dc-active-filter-chip"
          onClick={() => vm.updateFilter('familyOriented', false)}
        >
          {t('home.family_oriented')} <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );

  const browserLocationPrompt = vm.showBrowserLocationPrompt && (
    <div className="dc-location-prompt" role="status">
      <p className="dc-location-prompt-text">
        {t('discover.location_prompt', 'Use your device location for nearby results. Safari requires tapping the button below to allow access.')}
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
          {vm.browserLocationRequestPending ? t('discover.requesting_location', 'Requesting…') : t('discover.use_my_location', 'Use my location')}
        </button>
        <button
          type="button"
          className="dc-location-prompt-dismiss"
          onClick={vm.dismissBrowserLocationPrompt}
        >
          {t('discover.not_now', 'Not now')}
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
            {t('common.retry')}
          </button>
        </div>
      )}
      {vm.isLoading ? (
        <div className="dc-overlay-events-status">
          <span className="spinner" /> {t('home.loading_events')}
        </div>
      ) : vm.events.length === 0 && !vm.error ? (
        <div className="dc-overlay-events-status">
          {t('discover.no_events_match', 'No events match your filters.')}
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
                {vm.isLoadingMore ? <span className="spinner" /> : t('discover.load_more', 'Load more')}
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
            aria-label={t('common.close')}
          >
            ×
          </button>
          <h2 id="dc-loc-modal-title" className="dc-loc-modal-title">
            {t('home.choose_location_from_map')}
          </h2>
          {vm.defaultProfileLocation ? (
            <button
              type="button"
              className="dc-loc-modal-reset"
              onClick={vm.resetModalLocationDraft}
            >
              {t('common.retry')}
            </button>
          ) : (
            <span className="dc-loc-modal-header-spacer" aria-hidden />
          )}
        </div>

        <div className="dc-loc-modal-section">
          <p className="dc-loc-modal-section-label">{t('discover.current_location')}</p>
          {vm.hasBrowserLocation ? (
            <button
              type="button"
              className={`dc-loc-modal-pill ${browserLocCurrentlyApplied ? 'selected' : ''}`}
              onClick={vm.selectBrowserLocationInModal}
            >
              <CrosshairIcon className="dc-loc-modal-pill-icon" />
              <span>{t('discover.use_current_location')}</span>
            </button>
          ) : vm.browserLocationPermissionDenied ? (
            <p className="dc-loc-modal-permission">
              {vm.browserLocationError ?? t('home.location_prompt')}
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
                  ? t('discover.requesting_location')
                  : t('discover.use_my_location')}
              </span>
            </button>
          )}
        </div>

        {vm.defaultProfileLocation && (
          <div className="dc-loc-modal-section">
            <p className="dc-loc-modal-section-label">{t('discover.default_location')}</p>
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
            <p className="dc-loc-modal-section-label">{t('discover.favorite_locations')}</p>
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
            placeholder={t('discover.search_location_placeholder')}
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
              <p className="dc-loc-modal-hint">{t('common.searching')}</p>
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
              <p className="dc-loc-modal-hint">{t('discover.no_locations_found')}</p>
            )}
          </div>
        )}

        <button type="button" className="dc-loc-modal-apply" onClick={vm.applyModalLocation}>
          {t('discover.apply_location')}
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
          radiusMeters={vm.filters.radiusMeters}
          isChoosingLocation={isChoosingMapLocation}
          selectedEventId={selectedEventId}
          onSelectEvent={setSelectedEventId}
          onChooseLocation={handleChooseMapLocation}
          onRetry={vm.refresh}
        />

        <div
          className={`dc-overlay dc-overlay-top-left ${
            overlayCollapsed ? 'dc-overlay-top-left--collapsed' : ''
          }`}
        >
          {titleBlock}
          {searchToolbar}
          {!overlayCollapsed && activeAudienceChips}
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
        {activeAudienceChips}
        {categoriesBlock}
      </div>

      {locationModal}
      {filterModal}

      {vm.error && (
        <div className="error-banner">
          {vm.error}
          <button type="button" className="dc-retry-btn" onClick={vm.refresh}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {vm.isLoading && (
        <div className="dc-loading">
          <span className="spinner" />
          <p>{t('home.loading_events')}</p>
        </div>
      )}

      {!vm.isLoading && !vm.error && vm.events.length === 0 && (
        <div className="dc-empty">
          <h2>{t('discover.no_events_found')}</h2>
          <p>{t('discover.try_adjusting_filters')}</p>
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
                {vm.isLoadingMore ? <span className="spinner" /> : t('common.load_more')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
