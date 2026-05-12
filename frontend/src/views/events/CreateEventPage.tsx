import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreateEventViewModel,
  PRIVACY_OPTIONS,
  MAX_CONSTRAINTS,
} from '@/viewmodels/event/useCreateEventViewModel';
import type { PreferredGender, LocationType } from '@/models/event';
import RoutePointsEditor from '@/components/RoutePointsEditor';
import '@/styles/create-event.css';

const AGE_PRESETS = [
  { label: '18+', min: '18', max: '' },
  { label: '21+', min: '21', max: '' },
  { label: '16+', min: '16', max: '' },
  { label: '18-30', min: '18', max: '30' },
  { label: '18-65', min: '18', max: '65' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

function TimePicker({
  value,
  onChange,
  onBlur,
  hasError,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  hasError?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'hours' | 'minutes'>('hours');
  const [inputValue, setInputValue] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const hour = value.split(':')[0] ?? '';
  const minute = value.split(':')[1] ?? '';

  // Sync inputValue when value changes externally (e.g. from grid selection)
  useEffect(() => {
    const display = hour && minute ? `${hour}:${minute}` : '';
    setInputValue(display);
  }, [hour, minute]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open, handleClickOutside]);

  const selectHour = (h: string) => {
    const m = minute || '00';
    onChange(`${h}:${m}`);
    setView('minutes');
  };

  const selectMinute = (m: string) => {
    const h = hour || '00';
    onChange(`${h}:${m}`);
    setOpen(false);
    setView('hours');
  };

  const handleInputChange = (raw: string) => {
    // Allow only digits and colon while typing
    const cleaned = raw.replace(/[^0-9:]/g, '');
    setInputValue(cleaned);

    // Auto-insert colon after 2 digits
    if (cleaned.length === 2 && !cleaned.includes(':')) {
      setInputValue(cleaned + ':');
      return;
    }

    // Parse complete HH:MM
    const match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
      }
    }
  };

  const handleInputBlur = () => {
    // On blur, snap to the current valid value or clear
    if (hour && minute) {
      setInputValue(`${hour}:${minute}`);
    } else {
      setInputValue('');
    }
    onBlur?.();
  };

  return (
    <div className="ce-tp-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className={`field-input ce-tp-trigger ${hasError ? 'has-error' : ''}`}
        placeholder={t('common.time_placeholder')}
        maxLength={5}
        value={inputValue}
        onChange={(e) => handleInputChange(e.target.value)}
        onFocus={() => { if (!disabled) { setOpen(true); setView('hours'); } }}
        onBlur={handleInputBlur}
        disabled={disabled}
      />

      {open && (
        <div className="ce-tp-popup">
          <div className="ce-tp-header">
            <button
              type="button"
              className={`ce-tp-tab ${view === 'hours' ? 'active' : ''}`}
              onClick={() => setView('hours')}
            >
              {hour || 'HH'}
            </button>
            <span className="ce-tp-colon">:</span>
            <button
              type="button"
              className={`ce-tp-tab ${view === 'minutes' ? 'active' : ''}`}
              onClick={() => setView('minutes')}
            >
              {minute || 'MM'}
            </button>
          </div>

          {view === 'hours' ? (
            <div className="ce-tp-grid ce-tp-grid-hours">
              {HOURS.map((h) => (
                <button
                  key={h}
                  type="button"
                  className={`ce-tp-cell ${h === hour ? 'selected' : ''}`}
                  onClick={() => selectHour(h)}
                >
                  {h}
                </button>
              ))}
            </div>
          ) : (
            <div className="ce-tp-grid ce-tp-grid-minutes">
              {MINUTES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`ce-tp-cell ${m === minute ? 'selected' : ''}`}
                  onClick={() => selectMinute(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RequiredMark() {
  return <span className="ce-required-mark" aria-hidden>*</span>;
}

function CreateEventForm() {
  const { t } = useTranslation();
  const { token, username } = useAuth();
  const navigate = useNavigate();
  const vm = useCreateEventViewModel();
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = vm.isLoading || vm.isUploadingImage;
  const genderOptions: { label: string; value: PreferredGender }[] = [
    { label: t('auth.register.gender_options.male'), value: 'MALE' },
    { label: t('auth.register.gender_options.female'), value: 'FEMALE' },
    { label: t('auth.register.gender_options.other'), value: 'OTHER' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    const result = await vm.handleSubmit(token);
    if (result) {
      setShowSuccess(true);
    }
  };

  const handleSuccessDismiss = () => {
    setShowSuccess(false);
    navigate('/my-events', { replace: true });
  };

  return (
    <>
      {vm.imageUploadSuccessMessage ? (
        <div
          className="ce-fixed-success-toast"
          role="status"
        >
          {vm.imageUploadSuccessMessage}
        </div>
      ) : null}

      {showSuccess && (
        <div className="ce-popup-overlay" onClick={handleSuccessDismiss}>
          <div className="ce-popup" onClick={(e) => e.stopPropagation()}>
            <div className="ce-popup-icon">&#10003;</div>
            <h2 className="ce-popup-title">{t('create_event.created_title')}</h2>
            <p className="ce-popup-message">{t('create_event.created_message')}</p>
            {vm.coverImageUploadedForLastCreate ? (
              <p className="ce-popup-message ce-popup-message-secondary">
                {t('create_event.cover_uploaded_message')}
              </p>
            ) : null}
            <button
              type="button"
              className="btn-primary ce-popup-btn"
              onClick={handleSuccessDismiss}
            >
              {t('create_event.ok')}
            </button>
          </div>
        </div>
      )}
      {vm.apiError && <div className="error-banner">{vm.apiError}</div>}
      {vm.imageError && <div className="error-banner">{vm.imageError}</div>}

      <form className="create-event-form" onSubmit={handleSubmit}>
        {/* Host info */}
        <div className="ce-host-info">
          <span className="ce-host-label">{t('create_event.host')}</span>
          <span className="ce-host-name">{username}</span>
        </div>

        {/* Title */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-title">
            {t('create_event.title')} <RequiredMark />
          </label>
          <input
            id="event-title"
            className={`field-input ${vm.errors.title ? 'has-error' : ''}`}
            type="text"
            placeholder={t('create_event.title_placeholder')}
            maxLength={60}
            value={vm.form.title}
            onChange={(e) => {
              vm.touchField('title');
              vm.updateField('title', e.target.value);
            }}
            onBlur={() => vm.touchField('title')}
            disabled={busy}
          />
          <div className="ce-char-count">
            {vm.form.title.length}/60
          </div>
          {vm.errors.title && (
            <p className="field-error">{vm.errors.title}</p>
          )}
        </div>

        {/* Description */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-desc">
            {t('create_event.description')} <RequiredMark />
          </label>
          <textarea
            id="event-desc"
            className={`field-input ce-textarea ${vm.errors.description ? 'has-error' : ''}`}
            placeholder={t('create_event.description_placeholder')}
            maxLength={600}
            rows={4}
            value={vm.form.description}
            onChange={(e) => {
              vm.touchField('description');
              vm.updateField('description', e.target.value);
            }}
            onBlur={() => vm.touchField('description')}
            disabled={busy}
          />
          <div className="ce-char-count">
            {vm.form.description.length}/600
          </div>
          {vm.errors.description && (
            <p className="field-error">{vm.errors.description}</p>
          )}
        </div>

        {/* Category */}
        <div className="field-group">
          <label className="field-label">{t('create_event.category')} <RequiredMark /></label>
          <div className="ce-category-grid">
            {vm.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`ce-category-chip ${vm.form.categoryId === cat.id ? 'selected' : ''}`}
                onClick={() => {
                  vm.touchField('categoryId');
                  vm.updateField('categoryId', cat.id);
                }}
                disabled={busy}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {vm.errors.categoryId && (
            <p className="field-error">{vm.errors.categoryId}</p>
          )}
        </div>

        {/* Event Image */}
        <div className="field-group">
          <label className="field-label">
            {t('create_event.event_image')} <RequiredMark />
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="ce-file-hidden"
            onChange={(e) => vm.handleImageUpload(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          {vm.form.imagePreview ? (
            <div className="ce-image-preview-wrapper">
              <img src={vm.form.imagePreview} alt={t('create_event.event_preview_alt')} className="ce-image-preview" />
              <button
                type="button"
                className="ce-image-remove"
                onClick={() => {
                  vm.removeImage();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                {t('create_event.remove')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ce-image-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={busy}
            >
              {t('create_event.upload_image')}
            </button>
          )}
          {vm.errors.image && (
            <p className="field-error">{vm.errors.image}</p>
          )}
        </div>

        {/* Location */}
        <div className="field-group">
          <label className="field-label">
            {t('create_event.location')} <RequiredMark />
          </label>
          <div className="ce-location-type-row">
            {([
              { label: t('create_event.point'), value: 'POINT' as LocationType },
              { label: t('create_event.route'), value: 'ROUTE' as LocationType },
            ]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ce-location-type-chip ${vm.form.locationType === opt.value ? 'selected' : ''}`}
                onClick={() => vm.setLocationType(opt.value)}
                disabled={busy}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {vm.form.locationType === 'POINT' ? (
            <>
              <div className="ce-location-wrapper">
                <input
                  id="event-location"
                  className={`field-input ${vm.errors.location ? 'has-error' : ''}`}
                  type="text"
                  placeholder={t('create_event.location_search_placeholder')}
                  value={vm.form.locationQuery}
                  onChange={(e) => vm.handleLocationSearch(e.target.value)}
                  onBlur={() => vm.touchField('location')}
                  disabled={busy}
                />
                {vm.locationSearching && (
                  <div className="ce-location-searching">{t('create_event.searching')}</div>
                )}
                {vm.locationResults.length > 0 && (
                  <ul className="ce-location-results">
                    {vm.locationResults.map((loc, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          className="ce-location-item"
                          onClick={() => vm.selectLocation(loc)}
                        >
                          {loc.display_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {vm.form.address && (
                <p className="ce-selected-location">{vm.form.address}</p>
              )}
            </>
          ) : (
            <RoutePointsEditor
              routePoints={vm.form.routePoints}
              locationQuery={vm.form.locationQuery}
              isSearching={vm.locationSearching}
              suggestions={vm.locationResults}
              errorText={vm.errors.location}
              disabled={busy}
              onSearch={vm.handleLocationSearch}
              onAddFromSuggestion={vm.addRoutePointFromSuggestion}
              onAddFromCoordinate={vm.addRoutePointFromCoordinate}
              onRemove={vm.removeRoutePoint}
              onMove={vm.moveRoutePoint}
              onUpdateLabel={vm.updateRoutePointLabel}
            />
          )}
          {vm.form.locationType === 'POINT' && vm.errors.location && (
            <p className="field-error">{vm.errors.location}</p>
          )}
        </div>

        {/* Date & Time */}
        <div className="ce-row">
          <div className="field-group ce-flex-1">
            <label className="field-label" htmlFor="start-date">
              {t('create_event.start_date')} <RequiredMark />
            </label>
            <input
              id="start-date"
              className={`field-input ${vm.errors.startDate ? 'has-error' : ''}`}
              type="date"
              value={vm.form.startDate}
              onChange={(e) => {
                vm.touchField('startDate');
                vm.updateField('startDate', e.target.value);
              }}
              onBlur={() => vm.touchField('startDate')}
              disabled={busy}
            />
            {vm.errors.startDate && (
              <p className="field-error">{vm.errors.startDate}</p>
            )}
          </div>
          <div className="field-group ce-flex-1">
            <label className="field-label">{t('create_event.start_time')} <RequiredMark /></label>
            <TimePicker
              value={vm.form.startTime}
              onChange={(val) => {
                vm.touchField('startTime');
                vm.updateField('startTime', val);
              }}
              onBlur={() => vm.touchField('startTime')}
              hasError={!!vm.errors.startTime}
              disabled={busy}
            />
            {vm.errors.startTime && (
              <p className="field-error">{vm.errors.startTime}</p>
            )}
          </div>
        </div>

        <div className="ce-row">
          <div className="field-group ce-flex-1">
            <label className="field-label" htmlFor="end-date">
              {t('create_event.end_date')} <span className="optional">({t('common.optional')})</span>
            </label>
            <input
              id="end-date"
              className={`field-input ${vm.errors.endDate ? 'has-error' : ''}`}
              type="date"
              value={vm.form.endDate}
              onChange={(e) => {
                vm.touchField('endDate');
                vm.updateField('endDate', e.target.value);
              }}
              onBlur={() => vm.touchField('endDate')}
              disabled={busy}
            />
            {vm.errors.endDate && (
              <p className="field-error">{vm.errors.endDate}</p>
            )}
          </div>
          <div className="field-group ce-flex-1">
            <label className="field-label">
              {t('create_event.end_time')} <span className="optional">({t('common.optional')})</span>
            </label>
            <TimePicker
              value={vm.form.endTime}
              onChange={(val) => {
                vm.touchField('endTime');
                vm.updateField('endTime', val);
              }}
              onBlur={() => vm.touchField('endTime')}
              hasError={!!vm.errors.endTime}
              disabled={busy}
            />
            {vm.errors.endTime && (
              <p className="field-error">{vm.errors.endTime}</p>
            )}
          </div>
        </div>

        {/* Privacy Level */}
        <div className="field-group">
          <label className="field-label">{t('create_event.privacy')}</label>
          <div className="ce-privacy-row">
            {PRIVACY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ce-privacy-chip ${vm.form.privacyLevel === opt.value ? 'selected' : ''}`}
                onClick={() => vm.updateField('privacyLevel', opt.value)}
                disabled={busy}
              >
                {opt.value === 'PUBLIC'
                  ? t('create_event.privacy_public')
                  : opt.value === 'PROTECTED'
                    ? t('create_event.privacy_protected')
                    : t('create_event.privacy_private')}
              </button>
            ))}
          </div>
          <p className="field-hint">
            {vm.form.privacyLevel === 'PUBLIC'
              ? t('create_event.privacy_hint_public')
              : vm.form.privacyLevel === 'PROTECTED'
                ? t('create_event.privacy_hint_protected')
                : t('create_event.privacy_hint_private')}
          </p>
        </div>

        {/* Capacity */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-capacity">
            {t('create_event.capacity')} <span className="optional">({t('common.optional')})</span>
          </label>
          <input
            id="event-capacity"
            className={`field-input ce-short-input ${vm.errors.capacity ? 'has-error' : ''}`}
            type="number"
            min={2}
            placeholder={t('create_event.capacity_placeholder')}
            value={vm.form.capacity}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || parseInt(val, 10) >= 0) vm.updateField('capacity', val);
            }}
            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
            disabled={busy}
          />
          {vm.errors.capacity && (
            <p className="field-error">{vm.errors.capacity}</p>
          )}
        </div>

        {/* Tags */}
        <div className="field-group">
          <label className="field-label">
            {t('create_event.tags')} <span className="optional">({t('create_event.tags_limit')})</span>
          </label>
          <div className="ce-tag-input-row">
            <input
              className="field-input ce-tag-input"
              type="text"
              placeholder={t('create_event.tag_placeholder')}
              maxLength={20}
              value={vm.form.tagInput}
              onChange={(e) => vm.updateField('tagInput', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  vm.addTag();
                }
              }}
              disabled={busy || vm.form.tags.length >= 5}
            />
            <button
              type="button"
              className="ce-tag-add-btn"
              onClick={vm.addTag}
              disabled={busy || vm.form.tags.length >= 5 || !vm.form.tagInput.trim()}
            >
              {t('create_event.add')}
            </button>
          </div>
          {vm.form.tags.length > 0 && (
            <div className="ce-tags-list">
              {vm.form.tags.map((tag, i) => (
                <span key={i} className="ce-tag">
                  {tag}
                  <button
                    type="button"
                    className="ce-tag-remove"
                    onClick={() => vm.removeTag(i)}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <fieldset className="ce-constraints-section ce-audience-section">
          <legend className="field-label">
            {t('create_event.audience_attributes')} <span className="optional">({t('common.optional')})</span>
          </legend>
          <div className="ce-audience-grid">
            <label className={`ce-audience-toggle ${vm.form.childFriendly ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={vm.form.childFriendly}
                onChange={(e) => vm.updateField('childFriendly', e.target.checked)}
                disabled={busy}
              />
              <span className="ce-audience-toggle-text">
                <span className="ce-audience-toggle-title">{t('create_event.child_friendly')}</span>
                <span className="ce-audience-toggle-copy">{t('create_event.child_friendly_copy')}</span>
              </span>
            </label>
            <label className={`ce-audience-toggle ${vm.form.familyOriented ? 'selected' : ''}`}>
              <input
                type="checkbox"
                checked={vm.form.familyOriented}
                onChange={(e) => vm.updateField('familyOriented', e.target.checked)}
                disabled={busy}
              />
              <span className="ce-audience-toggle-text">
                <span className="ce-audience-toggle-title">{t('create_event.family_oriented')}</span>
                <span className="ce-audience-toggle-copy">{t('create_event.family_oriented_copy')}</span>
              </span>
            </label>
          </div>
        </fieldset>

        {/* Participation Constraints */}
        <fieldset className="ce-constraints-section">
          <legend className="field-label">
            {t('create_event.participation_constraints')} <span className="optional">({t('common.optional')})</span>
          </legend>

          {/* Age Presets */}
          <div className="field-group">
            <label className="field-label ce-sub-label">{t('create_event.age_restriction')}</label>
            <div className="ce-age-presets">
              {AGE_PRESETS.map((preset) => {
                const isActive =
                  vm.form.minimumAge === preset.min && vm.form.maximumAge === preset.max;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    className={`ce-age-preset-chip ${isActive ? 'selected' : ''}`}
                    onClick={() => {
                      if (isActive) {
                        vm.updateField('minimumAge', '');
                        vm.updateField('maximumAge', '');
                      } else {
                        vm.updateField('minimumAge', preset.min);
                        vm.updateField('maximumAge', preset.max);
                      }
                    }}
                    disabled={busy}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Min / Max Age */}
          <div className="ce-row">
            <div className="field-group ce-flex-1">
              <label className="field-label ce-sub-label" htmlFor="min-age">
                {t('create_event.min_age')}
              </label>
              <input
                id="min-age"
                className={`field-input ce-short-input ${vm.errors.minimumAge ? 'has-error' : ''}`}
                type="number"
                min={1}
                max={120}
                placeholder={t('create_event.min_age_placeholder')}
                value={vm.form.minimumAge}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || parseInt(val, 10) >= 0) vm.updateField('minimumAge', val);
                }}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                disabled={busy}
              />
              {vm.errors.minimumAge && (
                <p className="field-error">{vm.errors.minimumAge}</p>
              )}
            </div>
            <div className="field-group ce-flex-1">
              <label className="field-label ce-sub-label" htmlFor="max-age">
                {t('create_event.max_age')}
              </label>
              <input
                id="max-age"
                className={`field-input ce-short-input ${vm.errors.maximumAge ? 'has-error' : ''}`}
                type="number"
                min={1}
                max={120}
                placeholder={t('create_event.max_age_placeholder')}
                value={vm.form.maximumAge}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || parseInt(val, 10) >= 0) vm.updateField('maximumAge', val);
                }}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                disabled={busy}
              />
              {vm.errors.maximumAge && (
                <p className="field-error">{vm.errors.maximumAge}</p>
              )}
            </div>
          </div>

          {/* Preferred Gender */}
          <div className="field-group">
            <label className="field-label ce-sub-label">{t('create_event.preferred_gender')}</label>
            <div className="ce-privacy-row">
              {genderOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`ce-privacy-chip ${vm.form.preferredGender === opt.value ? 'selected' : ''}`}
                  onClick={() =>
                    vm.updateField(
                      'preferredGender',
                      vm.form.preferredGender === opt.value ? '' : opt.value,
                    )
                  }
                  disabled={busy}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Constraints */}
          <div className="field-group">
            <label className="field-label ce-sub-label">{t('create_event.other_constraints')}</label>
            <div className="ce-tag-input-row">
              <input
                className="field-input ce-tag-input"
                type="text"
                placeholder={t('create_event.other_constraints_placeholder')}
                value={vm.form.otherConstraintInput}
                onChange={(e) => vm.updateField('otherConstraintInput', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    vm.addConstraint();
                  }
                }}
                disabled={busy || vm.form.constraints.length >= 5}
              />
              <button
                type="button"
                className="ce-tag-add-btn"
                onClick={vm.addConstraint}
                disabled={
                  busy ||
                  vm.form.constraints.length >= MAX_CONSTRAINTS ||
                  !vm.form.otherConstraintInput.trim()
                }
              >
                {t('create_event.add')}
              </button>
            </div>
            {vm.form.constraints.length > 0 && (
              <div className="ce-tags-list">
                {vm.form.constraints.map((c, i) => (
                  <span key={i} className="ce-tag">
                    {c.info}
                    <button
                      type="button"
                      className="ce-tag-remove"
                      onClick={() => vm.removeConstraint(i)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </fieldset>

        {/* Submit */}
        <button
          type="submit"
          className="btn-primary ce-submit"
          disabled={busy}
        >
          {vm.isUploadingImage ? (
            t('create_event.uploading_image')
          ) : vm.isLoading ? (
            <span className="spinner" />
          ) : (
            t('create_event.submitting')
          )}
        </button>
      </form>
    </>
  );
}

export default function CreateEventPage() {
  const { t } = useTranslation();
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="create-event-page">
        <h1 className="create-event-title">{t('create_event.page_title')}</h1>
        <div className="error-banner">
          {t('create_event.load_error')}
        </div>
      </div>
    );
  }

  return (
    <div className="create-event-page">
      <h1 className="create-event-title">{t('create_event.page_title')}</h1>
      <p className="create-event-subtitle">
        {t('create_event.page_subtitle')}
      </p>
      <ErrorBoundary onError={() => setHasError(true)}>
        <CreateEventForm />
      </ErrorBoundary>
    </div>
  );
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
