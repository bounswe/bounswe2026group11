import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  useCreateEventViewModel,
  PRIVACY_OPTIONS,
  MAX_CONSTRAINTS,
} from '@/viewmodels/event/useCreateEventViewModel';
import type { PreferredGender } from '@/models/event';
import '@/styles/create-event.css';

const GENDER_OPTIONS: { label: string; value: PreferredGender }[] = [
  { label: 'Male', value: 'MALE' },
  { label: 'Female', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
];

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
  hasError,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  hasError?: boolean;
  disabled?: boolean;
}) {
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
  };

  return (
    <div className="ce-tp-wrapper" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        className={`field-input ce-tp-trigger ${hasError ? 'has-error' : ''}`}
        placeholder="HH:MM"
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

function CreateEventForm() {
  const { token, username } = useAuth();
  const navigate = useNavigate();
  const vm = useCreateEventViewModel();
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      {showSuccess && (
        <div className="ce-popup-overlay" onClick={handleSuccessDismiss}>
          <div className="ce-popup" onClick={(e) => e.stopPropagation()}>
            <div className="ce-popup-icon">&#10003;</div>
            <h2 className="ce-popup-title">Event Created!</h2>
            <p className="ce-popup-message">
              Your event has been successfully created.
            </p>
            <button
              type="button"
              className="btn-primary ce-popup-btn"
              onClick={handleSuccessDismiss}
            >
              OK
            </button>
          </div>
        </div>
      )}
      {vm.apiError && <div className="error-banner">{vm.apiError}</div>}

      <form className="create-event-form" onSubmit={handleSubmit}>
        {/* Host info */}
        <div className="ce-host-info">
          <span className="ce-host-label">Host:</span>
          <span className="ce-host-name">{username}</span>
        </div>

        {/* Title */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-title">
            Title
          </label>
          <input
            id="event-title"
            className={`field-input ${vm.errors.title ? 'has-error' : ''}`}
            type="text"
            placeholder="Give your event a catchy title"
            maxLength={60}
            value={vm.form.title}
            onChange={(e) => vm.updateField('title', e.target.value)}
            disabled={vm.isLoading}
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
            Description
          </label>
          <textarea
            id="event-desc"
            className={`field-input ce-textarea ${vm.errors.description ? 'has-error' : ''}`}
            placeholder="Describe your event in detail"
            maxLength={600}
            rows={4}
            value={vm.form.description}
            onChange={(e) => vm.updateField('description', e.target.value)}
            disabled={vm.isLoading}
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
          <label className="field-label">Category</label>
          <div className="ce-category-grid">
            {vm.categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`ce-category-chip ${vm.form.categoryId === cat.id ? 'selected' : ''}`}
                onClick={() => vm.updateField('categoryId', cat.id)}
                disabled={vm.isLoading}
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
            Event Image <span className="optional">(optional)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="ce-file-hidden"
            onChange={(e) => vm.handleImageUpload(e.target.files?.[0] ?? null)}
            disabled={vm.isLoading}
          />
          {vm.form.imagePreview ? (
            <div className="ce-image-preview-wrapper">
              <img src={vm.form.imagePreview} alt="Event preview" className="ce-image-preview" />
              <button
                type="button"
                className="ce-image-remove"
                onClick={() => {
                  vm.removeImage();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                Remove
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="ce-image-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={vm.isLoading}
            >
              Upload Image
            </button>
          )}
        </div>

        {/* Location */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-location">
            Location
          </label>
          <div className="ce-location-wrapper">
            <input
              id="event-location"
              className={`field-input ${vm.errors.location ? 'has-error' : ''}`}
              type="text"
              placeholder="Search for a location..."
              value={vm.form.locationQuery}
              onChange={(e) => vm.handleLocationSearch(e.target.value)}
              disabled={vm.isLoading}
            />
            {vm.locationSearching && (
              <div className="ce-location-searching">Searching...</div>
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
          {vm.errors.location && (
            <p className="field-error">{vm.errors.location}</p>
          )}
        </div>

        {/* Date & Time */}
        <div className="ce-row">
          <div className="field-group ce-flex-1">
            <label className="field-label" htmlFor="start-date">
              Start Date
            </label>
            <input
              id="start-date"
              className={`field-input ${vm.errors.startDate ? 'has-error' : ''}`}
              type="date"
              value={vm.form.startDate}
              onChange={(e) => vm.updateField('startDate', e.target.value)}
              disabled={vm.isLoading}
            />
            {vm.errors.startDate && (
              <p className="field-error">{vm.errors.startDate}</p>
            )}
          </div>
          <div className="field-group ce-flex-1">
            <label className="field-label">Start Time</label>
            <TimePicker
              value={vm.form.startTime}
              onChange={(val) => vm.updateField('startTime', val)}
              hasError={!!vm.errors.startTime}
              disabled={vm.isLoading}
            />
            {vm.errors.startTime && (
              <p className="field-error">{vm.errors.startTime}</p>
            )}
          </div>
        </div>

        <div className="ce-row">
          <div className="field-group ce-flex-1">
            <label className="field-label" htmlFor="end-date">
              End Date <span className="optional">(optional)</span>
            </label>
            <input
              id="end-date"
              className={`field-input ${vm.errors.endDate ? 'has-error' : ''}`}
              type="date"
              value={vm.form.endDate}
              onChange={(e) => vm.updateField('endDate', e.target.value)}
              disabled={vm.isLoading}
            />
            {vm.errors.endDate && (
              <p className="field-error">{vm.errors.endDate}</p>
            )}
          </div>
          <div className="field-group ce-flex-1">
            <label className="field-label">
              End Time <span className="optional">(optional)</span>
            </label>
            <TimePicker
              value={vm.form.endTime}
              onChange={(val) => vm.updateField('endTime', val)}
              hasError={!!vm.errors.endTime}
              disabled={vm.isLoading}
            />
            {vm.errors.endTime && (
              <p className="field-error">{vm.errors.endTime}</p>
            )}
          </div>
        </div>

        {/* Privacy Level */}
        <div className="field-group">
          <label className="field-label">Privacy</label>
          <div className="ce-privacy-row">
            {PRIVACY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`ce-privacy-chip ${vm.form.privacyLevel === opt.value ? 'selected' : ''}`}
                onClick={() => vm.updateField('privacyLevel', opt.value)}
                disabled={vm.isLoading}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Capacity */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-capacity">
            Capacity <span className="optional">(optional)</span>
          </label>
          <input
            id="event-capacity"
            className={`field-input ce-short-input ${vm.errors.capacity ? 'has-error' : ''}`}
            type="number"
            min={2}
            placeholder="e.g. 50"
            value={vm.form.capacity}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || parseInt(val, 10) >= 0) vm.updateField('capacity', val);
            }}
            onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
            disabled={vm.isLoading}
          />
          {vm.errors.capacity && (
            <p className="field-error">{vm.errors.capacity}</p>
          )}
        </div>

        {/* Tags */}
        <div className="field-group">
          <label className="field-label">
            Tags <span className="optional">(up to 5)</span>
          </label>
          <div className="ce-tag-input-row">
            <input
              className="field-input ce-tag-input"
              type="text"
              placeholder="Add a tag"
              maxLength={20}
              value={vm.form.tagInput}
              onChange={(e) => vm.updateField('tagInput', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  vm.addTag();
                }
              }}
              disabled={vm.isLoading || vm.form.tags.length >= 5}
            />
            <button
              type="button"
              className="ce-tag-add-btn"
              onClick={vm.addTag}
              disabled={vm.isLoading || vm.form.tags.length >= 5 || !vm.form.tagInput.trim()}
            >
              Add
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

        {/* Participation Constraints */}
        <fieldset className="ce-constraints-section">
          <legend className="field-label">
            Participation Constraints <span className="optional">(optional)</span>
          </legend>

          {/* Age Presets */}
          <div className="field-group">
            <label className="field-label ce-sub-label">Age Restriction</label>
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
                    disabled={vm.isLoading}
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
                Min Age
              </label>
              <input
                id="min-age"
                className={`field-input ce-short-input ${vm.errors.minimumAge ? 'has-error' : ''}`}
                type="number"
                min={1}
                max={120}
                placeholder="e.g. 18"
                value={vm.form.minimumAge}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || parseInt(val, 10) >= 0) vm.updateField('minimumAge', val);
                }}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                disabled={vm.isLoading}
              />
              {vm.errors.minimumAge && (
                <p className="field-error">{vm.errors.minimumAge}</p>
              )}
            </div>
            <div className="field-group ce-flex-1">
              <label className="field-label ce-sub-label" htmlFor="max-age">
                Max Age
              </label>
              <input
                id="max-age"
                className={`field-input ce-short-input ${vm.errors.maximumAge ? 'has-error' : ''}`}
                type="number"
                min={1}
                max={120}
                placeholder="e.g. 65"
                value={vm.form.maximumAge}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || parseInt(val, 10) >= 0) vm.updateField('maximumAge', val);
                }}
                onKeyDown={(e) => { if (e.key === '-' || e.key === 'e') e.preventDefault(); }}
                disabled={vm.isLoading}
              />
              {vm.errors.maximumAge && (
                <p className="field-error">{vm.errors.maximumAge}</p>
              )}
            </div>
          </div>

          {/* Preferred Gender */}
          <div className="field-group">
            <label className="field-label ce-sub-label">Preferred Gender</label>
            <div className="ce-privacy-row">
              {GENDER_OPTIONS.map((opt) => (
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
                  disabled={vm.isLoading}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Constraints */}
          <div className="field-group">
            <label className="field-label ce-sub-label">Other Constraints</label>
            <div className="ce-tag-input-row">
              <input
                className="field-input ce-tag-input"
                type="text"
                placeholder="e.g. Bring your own equipment"
                value={vm.form.otherConstraintInput}
                onChange={(e) => vm.updateField('otherConstraintInput', e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    vm.addConstraint();
                  }
                }}
                disabled={vm.isLoading || vm.form.constraints.length >= 5}
              />
              <button
                type="button"
                className="ce-tag-add-btn"
                onClick={vm.addConstraint}
                disabled={
                  vm.isLoading ||
                  vm.form.constraints.length >= MAX_CONSTRAINTS ||
                  !vm.form.otherConstraintInput.trim()
                }
              >
                Add
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
          disabled={vm.isLoading}
        >
          {vm.isLoading ? <span className="spinner" /> : 'Create Event'}
        </button>
      </form>
    </>
  );
}

export default function CreateEventPage() {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div className="create-event-page">
        <h1 className="create-event-title">Create a New Event</h1>
        <div className="error-banner">
          Something went wrong loading the form. Please try refreshing the page.
        </div>
      </div>
    );
  }

  return (
    <div className="create-event-page">
      <h1 className="create-event-title">Create a New Event</h1>
      <p className="create-event-subtitle">
        Fill in the details below to set up your event.
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
