import React, { useState } from 'react';
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

function CreateEventForm() {
  const { token, username } = useAuth();
  const navigate = useNavigate();
  const vm = useCreateEventViewModel();
  const [showSuccess, setShowSuccess] = useState(false);

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

        {/* Image URL */}
        <div className="field-group">
          <label className="field-label" htmlFor="event-image">
            Image URL <span className="optional">(optional)</span>
          </label>
          <input
            id="event-image"
            className="field-input"
            type="url"
            placeholder="https://example.com/image.jpg"
            value={vm.form.imageUrl}
            onChange={(e) => vm.updateField('imageUrl', e.target.value)}
            disabled={vm.isLoading}
          />
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
            <label className="field-label" htmlFor="start-time">
              Start Time
            </label>
            <input
              id="start-time"
              className={`field-input ${vm.errors.startTime ? 'has-error' : ''}`}
              type="time"
              value={vm.form.startTime}
              onChange={(e) => vm.updateField('startTime', e.target.value)}
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
            <label className="field-label" htmlFor="end-time">
              End Time <span className="optional">(optional)</span>
            </label>
            <input
              id="end-time"
              className={`field-input ${vm.errors.endTime ? 'has-error' : ''}`}
              type="time"
              value={vm.form.endTime}
              onChange={(e) => vm.updateField('endTime', e.target.value)}
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
            onChange={(e) => vm.updateField('capacity', e.target.value)}
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

          {/* Minimum Age */}
          <div className="field-group">
            <label className="field-label ce-sub-label" htmlFor="min-age">
              Minimum Age
            </label>
            <input
              id="min-age"
              className={`field-input ce-short-input ${vm.errors.minimumAge ? 'has-error' : ''}`}
              type="number"
              min={1}
              max={120}
              placeholder="e.g. 18"
              value={vm.form.minimumAge}
              onChange={(e) => vm.updateField('minimumAge', e.target.value)}
              disabled={vm.isLoading}
            />
            {vm.errors.minimumAge && (
              <p className="field-error">{vm.errors.minimumAge}</p>
            )}
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
