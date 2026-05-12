import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  return (
    <div className="ce-popup-overlay" role="presentation">
      <div className="ce-popup ce-edit-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="edit-confirm-title">
        <div className="ce-popup-icon">!</div>
        <h2 id="edit-confirm-title" className="ce-popup-title">{t('edit_event.confirm_title')}</h2>
        {preview.criticalChangeLabels.length > 0 ? (
          <>
            <p className="ce-popup-message">
              {t('edit_event.confirm_critical_message')}
            </p>
            <ul className="ce-edit-critical-list">
              {preview.criticalChangeLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="ce-popup-message">
            {t('edit_event.confirm_default_message')}
          </p>
        )}
        <div className="ce-edit-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            {t('edit_event.review_again')}
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={loading}>
            {loading ? t('profile.saving') : t('edit_event.save_update')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EditEventPage() {
  const { t } = useTranslation();
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
        <h1 className="create-event-title">{t('edit_event.loading')}</h1>
      </div>
    );
  }

  if (vm.apiError && !vm.event) {
    return (
      <div className="create-event-page edit-event-page">
        <h1 className="create-event-title">{t('edit_event.title')}</h1>
        <p className="create-event-subtitle">{vm.apiError}</p>
        <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>
          {t('edit_event.go_back')}
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
        &larr; {t('edit_event.back_to_event')}
      </Link>
      <h1 className="create-event-title">{t('edit_event.title')}</h1>
      <p className="create-event-subtitle">{t('edit_event.subtitle')}</p>

      {vm.successMessage && (
        <div className="success-banner" role="status">
          {vm.successMessage}
        </div>
      )}
      {vm.apiError && <div className="error-banner">{vm.apiError}</div>}

      {!vm.canEdit && (
        <div className="error-banner">
          {t('edit_event.not_editable')}
        </div>
      )}

      <form className="create-event-form edit-event-form" onSubmit={handleSubmit}>
        <div className="ce-host-info">
          <span className="ce-host-label">{t('edit_event.current_version')}</span>
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
          <label className="field-label" htmlFor="edit-description">{t('edit_event.description')}</label>
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
            <option value="">{t('edit_event.select_category')}</option>
            {vm.categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
          {vm.errors.categoryId && <p className="field-error">{vm.errors.categoryId}</p>}
        </div>

        <div className="field-group">
          <span className="field-label">
            {t('edit_event.location')} <RequiredMark />
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
                {type === 'POINT' ? t('create_event.point') : t('create_event.route')}
              </button>
            ))}
          </div>
        </div>

        {vm.form.locationType === 'POINT' ? (
          <div className="field-group">
            <label className="field-label" htmlFor="edit-location-search">
              {t('edit_event.search_location')} <RequiredMark />
            </label>
            <input
              id="edit-location-search"
              className={`field-input ${vm.errors.location ? 'has-error' : ''}`}
              value={vm.form.locationQuery}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.handleLocationSearch(e.target.value)}
              placeholder={t('edit_event.search_place_placeholder')}
            />
            {vm.locationSearching && <p className="field-hint">{t('common.searching')}</p>}
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
                {t('edit_event.selected_coordinates', { lat: vm.form.lat.toFixed(5), lon: vm.form.lon.toFixed(5) })}
              </p>
            )}
            {vm.errors.location && <p className="field-error">{vm.errors.location}</p>}
          </div>
        ) : (
          <div className="field-group">
            <label className="field-label" htmlFor="edit-route-address">{t('edit_event.route_label')}</label>
            <input
              id="edit-route-address"
              className="field-input"
              value={vm.form.address}
              disabled={busy || !vm.canEdit}
              onChange={(e) => vm.updateField('address', e.target.value)}
              placeholder={t('edit_event.route_label_placeholder')}
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
              {t('edit_event.start_date')} <RequiredMark />
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
              {t('edit_event.start_time')} <RequiredMark />
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
            <label className="field-label" htmlFor="edit-end-date">{t('edit_event.end_date')}</label>
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
            <label className="field-label" htmlFor="edit-end-time">{t('edit_event.end_time')}</label>
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
          <label className="field-label" htmlFor="edit-capacity">{t('edit_event.capacity')}</label>
          <input
            id="edit-capacity"
            type="number"
            min={2}
            className={`field-input ${vm.errors.capacity ? 'has-error' : ''}`}
            value={vm.form.capacity}
            disabled={busy || !vm.canEdit}
            onChange={(e) => vm.updateField('capacity', e.target.value)}
            placeholder={t('common.unlimited')}
          />
          {vm.errors.capacity && <p className="field-error">{vm.errors.capacity}</p>}
        </div>

        <div className="field-group">
          <label className="field-label">{t('edit_event.requirements')}</label>
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
              placeholder={t('edit_event.constraint_type_placeholder')}
            />
            <input
              className="field-input"
              value={vm.form.constraintInfo}
              disabled={busy || !vm.canEdit || vm.form.constraints.length >= MAX_CONSTRAINTS}
              onChange={(e) => vm.updateField('constraintInfo', e.target.value)}
              placeholder={t('edit_event.constraint_details_placeholder')}
            />
            <button type="button" className="btn-secondary" disabled={busy || !vm.canEdit} onClick={vm.addConstraint}>
              {t('common.add')}
            </button>
          </div>
          {vm.errors.constraints && <p className="field-error">{vm.errors.constraints}</p>}
        </div>

        {vm.updateResult?.reconfirmation_required && (
          <div className="ce-edit-warning" role="status">
            {t('edit_event.reconfirmation_needed', { count: Math.max(
              vm.event?.pending_participant_count ?? 0,
              vm.updateResult.participants_marked_pending,
            ) })}
          </div>
        )}

        <div className="ce-edit-form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate(`/events/${vm.event?.id}`)} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !vm.canEdit}>
            {vm.isSaving ? t('profile.saving') : t('edit_event.preview_save')}
          </button>
        </div>
      </form>
    </div>
  );
}
