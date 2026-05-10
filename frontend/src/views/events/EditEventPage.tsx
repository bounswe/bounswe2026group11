import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import RoutePointsEditor from '@/components/RoutePointsEditor';
import { MAX_CONSTRAINTS } from '@/viewmodels/event/useCreateEventViewModel';
import {
  type EditEventChangePreview,
  useEditEventViewModel,
} from '@/viewmodels/event/useEditEventViewModel';
import type { LocationType } from '@/models/event';
import '@/styles/create-event.css';

function RequiredMark() {
  return <span className="ce-required-mark" aria-hidden>*</span>;
}

function CriticalChangeModal({
  preview,
  loading,
  onCancel,
  onConfirm,
}: {
  preview: EditEventChangePreview;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="ce-popup-overlay" role="presentation">
      <div className="ce-popup ce-edit-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="edit-confirm-title">
        <div className="ce-popup-icon">!</div>
        <h2 id="edit-confirm-title" className="ce-popup-title">Confirm event update</h2>
        {preview.criticalChangeLabels.length > 0 ? (
          <>
            <p className="ce-popup-message">
              These changes can require approved participants to reconfirm attendance:
            </p>
            <ul className="ce-edit-critical-list">
              {preview.criticalChangeLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="ce-popup-message">
            This update creates a new event version. Participants will see the latest event details.
          </p>
        )}
        <div className="ce-edit-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            Review Again
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? 'Saving...' : 'Save Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditEventPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const vm = useEditEventViewModel(id);
  const [pendingPreview, setPendingPreview] = useState<EditEventChangePreview | null>(null);
  const busy = vm.isLoading || vm.isSaving;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const preview = vm.previewChanges();
    if (!preview) return;
    setPendingPreview(preview);
  };

  const confirmSubmit = async () => {
    if (!pendingPreview) return;
    const result = await vm.handleSubmit(pendingPreview.request);
    if (result) setPendingPreview(null);
  };

  if (vm.isLoading) {
    return (
      <div className="create-event-page edit-event-page">
        <h1 className="create-event-title">Loading event...</h1>
      </div>
    );
  }

  if (vm.apiError && !vm.event) {
    return (
      <div className="create-event-page edit-event-page">
        <h1 className="create-event-title">Edit Event</h1>
        <p className="create-event-subtitle">{vm.apiError}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  if (!vm.event) return null;

  return (
    <div className="create-event-page edit-event-page">
      {pendingPreview && (
        <CriticalChangeModal
          preview={pendingPreview}
          loading={vm.isSaving}
          onCancel={() => setPendingPreview(null)}
          onConfirm={confirmSubmit}
        />
      )}

      <Link className="ce-edit-back-link" to={`/events/${vm.event.id}`}>
        &larr; Back to Event
      </Link>
      <h1 className="create-event-title">Edit Event</h1>
      <p className="create-event-subtitle">Update event details through the versioned event contract.</p>

      {vm.successMessage && (
        <div className="success-banner" role="status">
          {vm.successMessage}
        </div>
      )}
      {vm.apiError && <div className="error-banner">{vm.apiError}</div>}

      {!vm.canEdit && (
        <div className="error-banner">
          Only active events that have not started can be edited.
        </div>
      )}

      <form className="create-event-form edit-event-form" onSubmit={handleSubmit}>
        <div className="ce-host-info">
          <span className="ce-host-label">Current version:</span>
          <span className="ce-host-name">
            v{vm.event.version_no ?? vm.event.viewer_context.latest_event_version ?? 1}
          </span>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="edit-title">
            Title <RequiredMark />
          </label>
          <input
            id="edit-title"
            className={`field-input ${vm.errors.title ? 'has-error' : ''}`}
            value={vm.form.title}
            disabled={busy || !vm.canEdit}
            onChange={(e) => vm.updateField('title', e.target.value)}
          />
          {vm.errors.title && <p className="field-error">{vm.errors.title}</p>}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="edit-description">Description</label>
          <textarea
            id="edit-description"
            className={`field-input field-textarea ${vm.errors.description ? 'has-error' : ''}`}
            value={vm.form.description}
            disabled={busy || !vm.canEdit}
            onChange={(e) => vm.updateField('description', e.target.value)}
          />
          {vm.errors.description && <p className="field-error">{vm.errors.description}</p>}
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="edit-category">
            Category <RequiredMark />
          </label>
          <select
            id="edit-category"
            className={`field-input ${vm.errors.categoryId ? 'has-error' : ''}`}
            value={vm.form.categoryId ?? ''}
            disabled={busy || !vm.canEdit}
            onChange={(e) => vm.updateField('categoryId', e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Select category</option>
            {vm.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {vm.errors.categoryId && <p className="field-error">{vm.errors.categoryId}</p>}
        </div>

        <div className="field-group">
          <span className="field-label">
            Location <RequiredMark />
          </span>
          <div className="ce-location-type-row">
            {(['POINT', 'ROUTE'] as LocationType[]).map((type) => (
              <button
                key={type}
                type="button"
                className={`ce-location-type-chip ${vm.form.locationType === type ? 'selected' : ''}`}
                disabled={busy || !vm.canEdit}
                onClick={() => vm.setLocationType(type)}
              >
                {type === 'POINT' ? 'Point' : 'Route'}
              </button>
            ))}
          </div>
        </div>

        {vm.form.locationType === 'POINT' ? (
          <div className="field-group">
            <label className="field-label" htmlFor="edit-location-search">
              Search location <RequiredMark />
            </label>
            <input
              id="edit-location-search"
              className={`field-input ${vm.errors.location ? 'has-error' : ''}`}
              value={vm.form.locationQuery}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.handleLocationSearch(e.target.value)}
              placeholder="Search a place"
            />
            {vm.locationSearching && <p className="field-hint">Searching...</p>}
            {vm.locationResults.length > 0 && (
              <ul className="ce-location-results">
                {vm.locationResults.map((suggestion, index) => (
                  <li key={`${suggestion.lat}-${suggestion.lon}-${index}`}>
                    <button type="button" className="ce-location-item" onClick={() => vm.selectLocation(suggestion)}>
                      {suggestion.display_name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {vm.form.lat != null && vm.form.lon != null && (
              <p className="field-hint">
                Selected: {vm.form.lat.toFixed(5)}, {vm.form.lon.toFixed(5)}
              </p>
            )}
            {vm.errors.location && <p className="field-error">{vm.errors.location}</p>}
          </div>
        ) : (
          <div className="field-group">
            <label className="field-label" htmlFor="edit-route-address">Route label</label>
            <input
              id="edit-route-address"
              className="field-input"
              value={vm.form.address}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.updateField('address', e.target.value)}
              placeholder="Optional route label"
            />
            <RoutePointsEditor
              routePoints={vm.form.routePoints}
              locationQuery={vm.form.locationQuery}
              isSearching={vm.locationSearching}
              suggestions={vm.locationResults}
              errorText={vm.errors.location}
              disabled={busy || !vm.canEdit}
              onSearch={vm.handleLocationSearch}
              onAddFromSuggestion={vm.addRoutePointFromSuggestion}
              onAddFromCoordinate={vm.addRoutePointFromCoordinate}
              onRemove={vm.removeRoutePoint}
              onMove={vm.moveRoutePoint}
              onUpdateLabel={vm.updateRoutePointLabel}
            />
          </div>
        )}

        <div className="ce-row">
          <div className="field-group">
            <label className="field-label" htmlFor="edit-start-date">
              Start date <RequiredMark />
            </label>
            <input
              id="edit-start-date"
              type="date"
              className={`field-input ${vm.errors.startDate ? 'has-error' : ''}`}
              value={vm.form.startDate}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.updateField('startDate', e.target.value)}
            />
            {vm.errors.startDate && <p className="field-error">{vm.errors.startDate}</p>}
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="edit-start-time">
              Start time <RequiredMark />
            </label>
            <input
              id="edit-start-time"
              type="time"
              className={`field-input ${vm.errors.startTime ? 'has-error' : ''}`}
              value={vm.form.startTime}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.updateField('startTime', e.target.value)}
            />
            {vm.errors.startTime && <p className="field-error">{vm.errors.startTime}</p>}
          </div>
        </div>

        <div className="ce-row">
          <div className="field-group">
            <label className="field-label" htmlFor="edit-end-date">End date</label>
            <input
              id="edit-end-date"
              type="date"
              className={`field-input ${vm.errors.endDate ? 'has-error' : ''}`}
              value={vm.form.endDate}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.updateField('endDate', e.target.value)}
            />
            {vm.errors.endDate && <p className="field-error">{vm.errors.endDate}</p>}
          </div>
          <div className="field-group">
            <label className="field-label" htmlFor="edit-end-time">End time</label>
            <input
              id="edit-end-time"
              type="time"
              className={`field-input ${vm.errors.endTime ? 'has-error' : ''}`}
              value={vm.form.endTime}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.updateField('endTime', e.target.value)}
            />
            {vm.errors.endTime && <p className="field-error">{vm.errors.endTime}</p>}
          </div>
        </div>

        <div className="field-group">
          <label className="field-label" htmlFor="edit-capacity">Capacity</label>
          <input
            id="edit-capacity"
            type="number"
            min={2}
            className={`field-input ${vm.errors.capacity ? 'has-error' : ''}`}
            value={vm.form.capacity}
            disabled={busy || !vm.canEdit}
            onChange={(e) => vm.updateField('capacity', e.target.value)}
            placeholder="Unlimited"
          />
          {vm.errors.capacity && <p className="field-error">{vm.errors.capacity}</p>}
        </div>

        <div className="field-group">
          <label className="field-label">Participation requirements</label>
          {vm.form.constraints.length > 0 && (
            <ul className="ce-edit-constraint-list">
              {vm.form.constraints.map((constraint, index) => (
                <li key={`${constraint.type}-${index}`}>
                  <span>{constraint.type}: {constraint.info}</span>
                  <button
                    type="button"
                    className="ce-chip-remove"
                    disabled={busy || !vm.canEdit}
                    onClick={() => vm.removeConstraint(index)}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="ce-edit-constraint-row">
            <input
              className="field-input"
              value={vm.form.constraintType}
              disabled={busy || !vm.canEdit || vm.form.constraints.length >= MAX_CONSTRAINTS}
              onChange={(e) => vm.updateField('constraintType', e.target.value)}
              placeholder="Type"
            />
            <input
              className="field-input"
              value={vm.form.constraintInfo}
              disabled={busy || !vm.canEdit || vm.form.constraints.length >= MAX_CONSTRAINTS}
              onChange={(e) => vm.updateField('constraintInfo', e.target.value)}
              placeholder="Details"
            />
            <button type="button" className="btn-secondary" disabled={busy || !vm.canEdit} onClick={vm.addConstraint}>
              Add
            </button>
          </div>
          {vm.errors.constraints && <p className="field-error">{vm.errors.constraints}</p>}
        </div>

        {vm.updateResult?.reconfirmation_required && (
          <div className="ce-edit-warning" role="status">
            Reconfirmation needed: {Math.max(
              vm.event?.pending_participant_count ?? 0,
              vm.updateResult.participants_marked_pending,
            )}
          </div>
        )}

        <div className="ce-edit-form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/events/${vm.event?.id}`)} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !vm.canEdit}>
            {vm.isSaving ? 'Saving...' : 'Preview & Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
