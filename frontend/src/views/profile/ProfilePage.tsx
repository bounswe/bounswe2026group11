import '@/styles/profile.css';
import '@/styles/discover.css';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { EventCoverImage } from '@/components/EventCoverImage';
import { RatingWithCount } from '@/components/RatingWithCount';
import { profileService } from '@/services/profileService';
import { useProfileViewModel } from '../../viewmodels/profile/useProfileViewModel';
import type { BadgeCategory, CatalogBadge, EarnedBadge, EventSummary } from '../../models/profile';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { getEventCategoryPresentation } from '@/utils/eventCategoryPresentation';
import { formatEventLocation } from '@/utils/eventLocation';
import { ProfileEquipmentSection, ProfileShowcaseSection } from './ProfilePublicSections';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_MB = 10;

type ProfileHistoryTab = 'hosted' | 'attended';
type PasswordFieldKey = 'current' | 'new' | 'confirm';

const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  HOSTING: 'profile.badge_categories.HOSTING',
  PARTICIPATION: 'profile.badge_categories.PARTICIPATION',
  SOCIAL: 'profile.badge_categories.SOCIAL',
};

function formatBadgeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(i18n.resolvedLanguage, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getBadgeIcon(badge: Pick<CatalogBadge, 'slug' | 'category' | 'icon_url'>): string {
  if (badge.icon_url) return badge.icon_url;
  const bySlug: Record<string, string> = {
    FIRST_STEPS: '👣',
    REGULAR: '🎟️',
    VETERAN: '🏅',
    EXPLORER: '🧭',
    HOST_DEBUT: '🎤',
    SUPER_HOST: '🌟',
    TOP_RATED: '⭐',
    FAVORITE_FINDER: '📍',
  };
  if (bySlug[badge.slug]) return bySlug[badge.slug];
  if (badge.category === 'HOSTING') return '🎤';
  if (badge.category === 'SOCIAL') return '🤝';
  return '🏅';
}

function earnedToCatalogBadge(badge: EarnedBadge): CatalogBadge {
  return {
    ...badge,
    earned: true,
    earned_at: badge.earned_at,
  };
}

function BadgeIcon({ badge }: { badge: CatalogBadge }) {
  if (badge.icon_url) {
    return <img src={badge.icon_url} alt="" className="profile-badge-icon-img" />;
  }
  return <span className="profile-badge-icon-emoji" aria-hidden>{getBadgeIcon(badge)}</span>;
}

function BadgeCard({
  badge,
  compact = false,
  onClick,
}: {
  badge: CatalogBadge;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`profile-badge-card ${compact ? 'compact' : ''} ${badge.earned ? 'earned' : 'locked'}`}
      onClick={onClick}
    >
      <span className="profile-badge-icon-wrap">
        <BadgeIcon badge={badge} />
        {!badge.earned && <span className="profile-badge-lock" aria-label={i18n.t('profile.locked')}>🔒</span>}
      </span>
      <span className="profile-badge-name">{i18n.t(`profile.badge_names.${badge.slug}`, { defaultValue: badge.name })}</span>
      <span className="profile-badge-date">
        {badge.earned_at ? formatBadgeDate(badge.earned_at) : i18n.t('profile.not_earned')}
      </span>
    </button>
  );
}

function BadgeDetail({
  badge,
  onBack,
  onClose,
}: {
  badge: CatalogBadge;
  onBack: (() => void) | null;
  onClose: () => void;
}) {
  const badgeDescription = i18n.t(`profile.badge_descriptions.${badge.slug}`, { defaultValue: badge.description });

  return (
    <div className="profile-badge-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-badge-detail-title">
      <div className="profile-badge-modal-header">
        {onBack ? (
          <button type="button" className="profile-badge-modal-text-btn" onClick={onBack}>
            {i18n.t('common.back')}
          </button>
        ) : (
          <span className="profile-badge-modal-spacer" aria-hidden />
        )}
        <h2 id="profile-badge-detail-title" className="profile-badge-modal-title">{i18n.t('profile.badge_details')}</h2>
        <button type="button" className="profile-badge-modal-close" onClick={onClose} aria-label={i18n.t('common.close')}>
          ×
        </button>
      </div>
      <div className={`profile-badge-detail ${badge.earned ? 'earned' : 'locked'}`}>
        <span className="profile-badge-detail-icon">
          <BadgeIcon badge={badge} />
          {!badge.earned && <span className="profile-badge-lock detail" aria-label={i18n.t('profile.locked')}>🔒</span>}
        </span>
        <h3>{i18n.t(`profile.badge_names.${badge.slug}`, { defaultValue: badge.name })}</h3>
        <p className="profile-badge-detail-category">{i18n.t(BADGE_CATEGORY_LABELS[badge.category] ?? badge.category)}</p>
        <p className="profile-badge-detail-description">{badgeDescription}</p>
        <p className="profile-badge-detail-status">
          {badge.earned_at
            ? i18n.t('profile.earned_on', { date: formatBadgeDate(badge.earned_at) })
            : i18n.t('profile.not_yet_earned', { description: badgeDescription })}
        </p>
      </div>
    </div>
  );
}

function BadgeCatalogModal({
  badges,
  activeCategory,
  onCategoryChange,
  onSelectBadge,
  onClose,
}: {
  badges: CatalogBadge[];
  activeCategory: BadgeCategory | 'ALL';
  onCategoryChange: (category: BadgeCategory | 'ALL') => void;
  onSelectBadge: (badge: CatalogBadge) => void;
  onClose: () => void;
}) {
  const categories: Array<BadgeCategory | 'ALL'> = ['ALL', 'HOSTING', 'PARTICIPATION', 'SOCIAL'];
  const visibleBadges = activeCategory === 'ALL'
    ? badges
    : badges.filter((badge) => badge.category === activeCategory);

  return (
    <div className="profile-badge-modal-card wide" role="dialog" aria-modal="true" aria-labelledby="profile-badge-catalog-title">
      <div className="profile-badge-modal-header">
        <span className="profile-badge-modal-spacer" aria-hidden />
        <h2 id="profile-badge-catalog-title" className="profile-badge-modal-title">{i18n.t('profile.all_badges')}</h2>
        <button type="button" className="profile-badge-modal-close" onClick={onClose} aria-label={i18n.t('common.close')}>
          ×
        </button>
      </div>
      <div className="profile-badge-tabs" role="tablist" aria-label={i18n.t('profile.badge_categories_label')}>
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`profile-badge-tab ${activeCategory === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category === 'ALL' ? i18n.t('profile.badge_categories.ALL') : i18n.t(BADGE_CATEGORY_LABELS[category])}
          </button>
        ))}
      </div>
      {visibleBadges.length > 0 ? (
        <div className="profile-badge-catalog-grid">
          {visibleBadges.map((badge) => (
            <BadgeCard key={badge.slug} badge={badge} onClick={() => onSelectBadge(badge)} />
          ))}
        </div>
      ) : (
        <div className="profile-badges-empty">{i18n.t('profile.no_badges_category')}</div>
      )}
    </div>
  );
}

function ProfileBadgesSection({
  earnedBadges,
  badgeCatalog,
  badgesLoading,
  badgeError,
  onRetry,
}: {
  earnedBadges: EarnedBadge[];
  badgeCatalog: CatalogBadge[];
  badgesLoading: boolean;
  badgeError: string | null;
  onRetry: () => void;
}) {
  const [selectedBadge, setSelectedBadge] = useState<CatalogBadge | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<BadgeCategory | 'ALL'>('ALL');
  const badgesForPreview = badgeCatalog.length > 0
    ? badgeCatalog
    : earnedBadges.map(earnedToCatalogBadge);

  const closeModal = () => {
    setSelectedBadge(null);
    setCatalogOpen(false);
  };

  return (
    <section className="profile-badges">
      <div className="profile-badges-header">
        <div>
          <h2 className="profile-badges-title">{i18n.t('profile.badges_title')}</h2>
          <p className="profile-badges-subtitle">{i18n.t('profile.badges_subtitle')}</p>
        </div>
        <button
          type="button"
          className="profile-badges-view-all"
          onClick={() => {
            setCatalogOpen(true);
            setSelectedBadge(null);
          }}
          disabled={badgesLoading || badgesForPreview.length === 0}
        >
          {i18n.t('profile.view_all_badges')}
        </button>
      </div>

      {badgesLoading ? (
        <div className="profile-badges-state">{i18n.t('profile.loading_badges')}</div>
      ) : badgeError ? (
        <div className="profile-badges-state error">
          <span>{badgeError}</span>
          <button type="button" onClick={onRetry}>{i18n.t('common.retry')}</button>
        </div>
      ) : badgesForPreview.length > 0 ? (
        <div className="profile-badges-row" aria-label={i18n.t('profile.badges_title')}>
          {badgesForPreview.map((badge) => (
            <BadgeCard
              key={badge.slug}
              badge={badge}
              compact
              onClick={() => setSelectedBadge(badge)}
            />
          ))}
        </div>
      ) : (
        <div className="profile-badges-empty">{i18n.t('profile.no_badges')}</div>
      )}

      {(selectedBadge || catalogOpen) && (
        <div className="profile-badge-modal-overlay" role="presentation" onClick={closeModal}>
          <div onClick={(e) => e.stopPropagation()}>
            {selectedBadge ? (
              <BadgeDetail
                badge={selectedBadge}
                onBack={catalogOpen ? () => setSelectedBadge(null) : null}
                onClose={closeModal}
              />
            ) : (
              <BadgeCatalogModal
                badges={badgesForPreview}
                activeCategory={activeCategory}
                onCategoryChange={setActiveCategory}
                onSelectBadge={setSelectedBadge}
                onClose={closeModal}
              />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

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

function ProfileHistoryCard({ event }: { event: EventSummary }) {
  const lifecycle = getEventLifecyclePresentation(event.status);
  const category = getEventCategoryPresentation(event.category_name ?? event.category ?? 'Event', false).label;

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
        {event.privacy_level && event.privacy_level !== 'PRIVATE' && (
          <span className={`dc-privacy-badge dc-privacy-${event.privacy_level.toLowerCase()}`}>
            {i18n.t(`events.privacy.${event.privacy_level}`)}
          </span>
        )}
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
            {i18n.t('events.my_events.participants', { count: event.approved_participant_count ?? 0 })}
          </span>
          {event.host_score && (
            <RatingWithCount
              score={event.host_score.final_score}
              count={event.host_score.hosted_event_rating_count}
              className="dc-card-score"
            />
          )}
        </div>
      </div>
    </Link>
  );
}

type ChangePasswordSectionProps = {
  isPasswordFormOpen: boolean;
  togglePasswordForm: () => void;
  currentPassword: string;
  setCurrentPassword: (value: string) => void;
  newPassword: string;
  setNewPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  passwordErrors: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
  passwordError: string | null;
  passwordSuccess: string | null;
  isChangingPassword: boolean;
  handleChangePassword: (e: React.FormEvent) => void;
};

function ChangePasswordSection({
  isPasswordFormOpen,
  togglePasswordForm,
  currentPassword,
  setCurrentPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordErrors,
  passwordError,
  passwordSuccess,
  isChangingPassword,
  handleChangePassword,
}: ChangePasswordSectionProps) {
  const { t } = useTranslation();
  const [visiblePasswords, setVisiblePasswords] = useState<Record<PasswordFieldKey, boolean>>({
    current: false,
    new: false,
    confirm: false,
  });

  const togglePasswordVisibility = (field: PasswordFieldKey) => {
    setVisiblePasswords((current) => ({ ...current, [field]: !current[field] }));
  };

  return (
    <section className="change-password-section">
      <div className="change-password-header">
        <div>
          <h2 className="change-password-title">{t('profile.change_password_title')}</h2>
          <p className="change-password-subtitle">{t('profile.change_password_subtitle')}</p>
        </div>
        <button
          type="button"
          className="change-password-toggle"
          onClick={togglePasswordForm}
          disabled={isChangingPassword}
          aria-expanded={isPasswordFormOpen}
        >
          {isPasswordFormOpen ? t('profile.close_change_password') : t('profile.open_change_password')}
        </button>
      </div>

      {passwordSuccess && (
        <div className="change-password-success" role="status">
          {passwordSuccess}
        </div>
      )}

      {passwordError && (
        <div className="change-password-error" role="alert">
          {passwordError}
        </div>
      )}

      {isPasswordFormOpen && (
        <form className="change-password-form" onSubmit={handleChangePassword}>
          <div className="form-group">
            <label htmlFor="current-password">{t('profile.current_password')}</label>
            <div className="password-input-row">
              <input
                id="current-password"
                type={visiblePasswords.current ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isChangingPassword}
                autoComplete="current-password"
                aria-invalid={Boolean(passwordErrors.currentPassword)}
              />
              <button
                type="button"
                className="password-visibility-btn"
                onClick={() => togglePasswordVisibility('current')}
                disabled={isChangingPassword}
              >
                {visiblePasswords.current ? t('profile.hide_password') : t('profile.show_password')}
              </button>
            </div>
            {passwordErrors.currentPassword && (
              <p className="field-error">{passwordErrors.currentPassword}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="new-password">{t('profile.new_password')}</label>
            <div className="password-input-row">
              <input
                id="new-password"
                type={visiblePasswords.new ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isChangingPassword}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordErrors.newPassword)}
              />
              <button
                type="button"
                className="password-visibility-btn"
                onClick={() => togglePasswordVisibility('new')}
                disabled={isChangingPassword}
              >
                {visiblePasswords.new ? t('profile.hide_password') : t('profile.show_password')}
              </button>
            </div>
            {passwordErrors.newPassword && (
              <p className="field-error">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirm-new-password">{t('profile.confirm_new_password')}</label>
            <div className="password-input-row">
              <input
                id="confirm-new-password"
                type={visiblePasswords.confirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isChangingPassword}
                autoComplete="new-password"
                aria-invalid={Boolean(passwordErrors.confirmPassword)}
              />
              <button
                type="button"
                className="password-visibility-btn"
                onClick={() => togglePasswordVisibility('confirm')}
                disabled={isChangingPassword}
              >
                {visiblePasswords.confirm ? t('profile.hide_password') : t('profile.show_password')}
              </button>
            </div>
            {passwordErrors.confirmPassword && (
              <p className="field-error">{passwordErrors.confirmPassword}</p>
            )}
          </div>

          <div className="change-password-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={togglePasswordForm}
              disabled={isChangingPassword}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="save-btn"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? t('profile.updating_password') : t('profile.update_password')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { token } = useAuth();
  const { t } = useTranslation();
  const { locale } = useLocale();
  const {
    profile,
    publicProfile,
    publicProfileLoading,
    publicProfileError,
    refreshPublicProfile,
    hostedEvents,
    attendedEvents,
    earnedBadges,
    badgeCatalog,
    badgesLoading,
    badgeError,
    refreshBadges,
    isLoading,
    isEditing,
    isSaving,
    error,
    success,
    displayName,
    setDisplayName,
    bio,
    setBio,
    avatarPreview,
    handleFileChange,
    handleEditToggle,
    handleSave,
    locationQuery,
    handleLocationSearch,
    locationSuggestions,
    selectedLocation,
    selectLocation,
    clearLocation,
    isSearchingLocation,
    locationCleared,
    isPasswordFormOpen,
    togglePasswordForm,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    passwordErrors,
    passwordError,
    passwordSuccess,
    isChangingPassword,
    handleChangePassword,
    isEquipmentEditorOpen,
    equipmentDraft,
    updateEquipmentDraft,
    equipmentSubmitting,
    equipmentDeletingId,
    equipmentError,
    startCreatingEquipment,
    startEditingEquipment,
    cancelEquipmentEditor,
    handleEquipmentSubmit,
    handleDeleteEquipment,
    showcaseUploading,
    showcaseRemovingId,
    showcaseError,
    handleShowcaseUpload,
    handleDeleteShowcaseImage,
  } = useProfileViewModel(token);
  const [activeHistoryTab, setActiveHistoryTab] = useState<ProfileHistoryTab>('hosted');
  const [isLocaleSaving, setIsLocaleSaving] = useState(false);
  const [localeError, setLocaleError] = useState<string | null>(null);
  const prevLocaleRef = useRef(locale);

  useEffect(() => {
    if (prevLocaleRef.current === locale) return;
    prevLocaleRef.current = locale;
    if (!token) return;
    setIsLocaleSaving(true);
    setLocaleError(null);
    profileService.updateMyProfile({ locale }, token)
      .catch(() => setLocaleError(t('profile.language_sync_failed')))
      .finally(() => setIsLocaleSaving(false));
  }, [locale, token, t]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const showcaseInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return handleFileChange(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(t('profile.file_too_large', { count: MAX_SIZE_MB }));
      e.target.value = '';
      return;
    }
    handleFileChange(file);
  };

  const onShowcaseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(t('profile.file_too_large', { count: MAX_SIZE_MB }));
      e.target.value = '';
      return;
    }
    void handleShowcaseUpload(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="profile-container" style={{ textAlign: 'center' }}>
        <p>{t('profile.loading_profile')}</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container" style={{ textAlign: 'center' }}>
        <p>{t('profile.load_failed')}</p>
      </div>
    );
  }

  const displayAvatar = avatarPreview ?? profile.avatar_url;
  const activeHistoryEvents = activeHistoryTab === 'hosted' ? hostedEvents : attendedEvents;
  const changePasswordSection = (
    <ChangePasswordSection
      isPasswordFormOpen={isPasswordFormOpen}
      togglePasswordForm={togglePasswordForm}
      currentPassword={currentPassword}
      setCurrentPassword={setCurrentPassword}
      newPassword={newPassword}
      setNewPassword={setNewPassword}
      confirmPassword={confirmPassword}
      setConfirmPassword={setConfirmPassword}
      passwordErrors={passwordErrors}
      passwordError={passwordError}
      passwordSuccess={passwordSuccess}
      isChangingPassword={isChangingPassword}
      handleChangePassword={handleChangePassword}
    />
  );

  const publicProfileSections = publicProfileLoading && !publicProfile ? (
    <section className="profile-public-section">
      <div className="profile-public-state inline">
        <p>{t('profile.public_sections_loading')}</p>
      </div>
    </section>
  ) : publicProfile ? (
    <>
      <ProfileEquipmentSection
        items={publicProfile.equipment}
        actions={(
          <button
            type="button"
            className="edit-toggle-btn profile-inline-action-btn"
            onClick={startCreatingEquipment}
            disabled={equipmentSubmitting || equipmentDeletingId !== null}
          >
            {t('profile.add_equipment')}
          </button>
        )}
        itemActions={(item) => (
          <>
            <button
              type="button"
              className="profile-inline-btn"
              onClick={() => startEditingEquipment(item)}
              disabled={equipmentSubmitting || equipmentDeletingId === item.id}
            >
              {t('common.edit')}
            </button>
            <button
              type="button"
              className="profile-inline-btn danger"
              onClick={() => {
                if (window.confirm(t('profile.delete_equipment_confirm'))) {
                  void handleDeleteEquipment(item.id);
                }
              }}
              disabled={equipmentSubmitting || equipmentDeletingId === item.id}
            >
              {equipmentDeletingId === item.id ? t('profile.deleting') : t('common.delete')}
            </button>
          </>
        )}
        emptyMessage={t('public_profile.equipment_empty_self')}
      />

      {equipmentError ? (
        <div className="profile-section-feedback error" role="alert">
          {equipmentError}
        </div>
      ) : null}

      {isEquipmentEditorOpen ? (
        <form className="profile-inline-form" onSubmit={handleEquipmentSubmit}>
          <div className="profile-inline-form-header">
            <h3>{equipmentDraft.id ? t('profile.edit_equipment_title') : t('profile.add_equipment_title')}</h3>
            <p>{t('profile.equipment_intro')}</p>
          </div>

          <div className="form-group">
            <label htmlFor="equipment-name">{t('profile.equipment_name')}</label>
            <input
              id="equipment-name"
              type="text"
              value={equipmentDraft.name}
              onChange={(e) => updateEquipmentDraft('name', e.target.value)}
              maxLength={64}
              placeholder={t('profile.equipment_name_placeholder')}
              disabled={equipmentSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="equipment-description">{t('profile.equipment_description')}</label>
            <textarea
              id="equipment-description"
              value={equipmentDraft.description}
              onChange={(e) => updateEquipmentDraft('description', e.target.value)}
              maxLength={512}
              placeholder={t('profile.equipment_description_placeholder')}
              disabled={equipmentSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="equipment-image">{t('profile.equipment_image_url')}</label>
            <input
              id="equipment-image"
              type="url"
              value={equipmentDraft.imageUrl}
              onChange={(e) => updateEquipmentDraft('imageUrl', e.target.value)}
              placeholder={t('profile.equipment_image_placeholder')}
              disabled={equipmentSubmitting}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-btn"
              onClick={cancelEquipmentEditor}
              disabled={equipmentSubmitting}
            >
              {t('common.cancel')}
            </button>
            <button type="submit" className="save-btn" disabled={equipmentSubmitting}>
              {equipmentSubmitting ? t('profile.saving') : equipmentDraft.id ? t('profile.save_changes') : t('profile.add_equipment')}
            </button>
          </div>
        </form>
      ) : null}

      <input
        ref={showcaseInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={onShowcaseFileChange}
        style={{ display: 'none' }}
      />

      <ProfileShowcaseSection
        items={publicProfile.showcase_images}
        actions={(
          <button
            type="button"
            className="edit-toggle-btn profile-inline-action-btn"
            onClick={() => showcaseInputRef.current?.click()}
            disabled={showcaseUploading}
          >
            {showcaseUploading ? t('profile.uploading_image') : t('profile.upload_image')}
          </button>
        )}
        imageActions={(image) => (
          <button
            type="button"
            className="profile-showcase-remove"
            onClick={() => {
              if (window.confirm(t('profile.remove_showcase_confirm'))) {
                void handleDeleteShowcaseImage(image.id);
              }
            }}
            disabled={showcaseRemovingId === image.id}
            aria-label={t('profile.remove_showcase')}
          >
            {showcaseRemovingId === image.id ? t('profile.removing_image') : t('profile.remove_showcase')}
          </button>
        )}
        emptyMessage={t('public_profile.showcase_empty_self')}
      />

      {showcaseError ? (
        <div className="profile-section-feedback error" role="alert">
          {showcaseError}
        </div>
      ) : null}
    </>
  ) : (
    <section className="profile-public-section">
      <div className="profile-public-state inline">
        <p>{publicProfileError ?? 'Public profile sections are unavailable right now.'}</p>
        <button type="button" className="save-btn profile-public-retry" onClick={() => void refreshPublicProfile()}>
          {t('common.retry')}
        </button>
      </div>
    </section>
  );

  return (
    <div className="profile-container profile-container-wide">
      <div className="profile-header">
        <h1>{t('profile.title')}</h1>
        <button
          className="edit-toggle-btn"
          onClick={handleEditToggle}
          disabled={isSaving}
        >
          {isEditing ? t('profile.cancel_edit') : t('profile.edit_profile')}
        </button>
      </div>

      <section className="profile-language-card" style={{ marginBottom: '1.5rem' }}>
        <div className="profile-language-row">
          <div className="profile-language-text">
            <span className="profile-language-label">{t('profile.language_label')}</span>
            <span className="profile-language-hint">
              {isLocaleSaving ? t('profile.language_saving') : t('profile.language_subtitle')}
            </span>
          </div>
          <LanguageSwitcher />
        </div>
        {localeError && <p className="field-error" role="alert" style={{ marginTop: '0.5rem' }}>{localeError}</p>}
      </section>

      {error && (
        <div className="profile-feedback profile-feedback--error">
          {error}
        </div>
      )}

      {success && (
        <div className="profile-feedback profile-feedback--success">
          {success}
        </div>
      )}

      {/* Avatar */}
      <div className="avatar-preview">
        {displayAvatar ? (
          <img
            src={displayAvatar}
            alt={t('profile.profile_photo')}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="avatar-placeholder">
            {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : profile.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {!isEditing ? (
        <>
        <div className="profile-info">
          <div className="info-group">
            <label>{t('profile.username')}</label>
            <p>@{profile.username}</p>
          </div>
          <div className="info-group">
            <label>{t('profile.email')}</label>
            <p>
              {profile.email}
              <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: profile.email_verified ? 'green' : 'gray' }}>
                ({profile.email_verified ? t('common.verified') : t('common.unverified')})
              </span>
            </p>
          </div>
          <div className="info-group">
            <label>{t('profile.display_name')}</label>
            {profile.display_name ? <p>{profile.display_name}</p> : <p className="empty-state">{t('profile.no_display_name')}</p>}
          </div>
          <div className="info-group">
            <label>{t('profile.bio')}</label>
            {profile.bio ? <p>{profile.bio}</p> : <p className="empty-state">{t('profile.no_bio')}</p>}
          </div>
          <div className="info-group">
            <label>{t('profile.default_location')}</label>
            {profile.default_location_address ? (
              <p>{formatEventLocation(profile.default_location_address)}</p>
            ) : (
              <p className="empty-state">{t('profile.no_default_location')}</p>
            )}
          </div>
        </div>

        <ProfileBadgesSection
          earnedBadges={earnedBadges}
          badgeCatalog={badgeCatalog}
          badgesLoading={badgesLoading}
          badgeError={badgeError}
          onRetry={refreshBadges}
        />

        {publicProfileSections}

        {changePasswordSection}

        <section className="profile-history">
          <div className="profile-history-header">
            <h2 className="profile-history-title">{t('profile.participation_history')}</h2>
            <p className="profile-history-subtitle">{t('profile.participation_history_subtitle')}</p>
          </div>

          <div className="profile-history-tabs">
            <button
              type="button"
              className={`profile-history-tab ${activeHistoryTab === 'hosted' ? 'active' : ''}`}
              onClick={() => setActiveHistoryTab('hosted')}
            >
              {t('profile.hosted_tab')} <span className="profile-history-tab-count">{hostedEvents.length}</span>
            </button>
            <button
              type="button"
              className={`profile-history-tab ${activeHistoryTab === 'attended' ? 'active' : ''}`}
              onClick={() => setActiveHistoryTab('attended')}
            >
              {t('profile.attended_tab')} <span className="profile-history-tab-count">{attendedEvents.length}</span>
            </button>
          </div>

          {activeHistoryEvents.length > 0 ? (
            <div className="profile-history-grid">
              {activeHistoryEvents.map((event) => (
                <ProfileHistoryCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="profile-history-empty">
              <p className="profile-history-empty-title">{t('profile.no_history_title', { tab: t(activeHistoryTab === 'hosted' ? 'profile.hosted_tab' : 'profile.attended_tab').toLowerCase() })}</p>
              <p className="profile-history-empty-subtitle">
                {activeHistoryTab === 'hosted'
                  ? t('profile.no_history_subtitle_hosted')
                  : t('profile.no_history_subtitle_attended')}
              </p>
            </div>
          )}
        </section>
        </>
      ) : (
        <div className="profile-form">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>{t('profile.profile_photo')}</label>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                onChange={onFileChange}
                disabled={isSaving}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="cancel-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSaving}
              >
                {avatarPreview ? t('profile.change_photo') : t('profile.upload_photo')}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  className="cancel-btn"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => { handleFileChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  disabled={isSaving}
                >
                  {t('profile.remove_photo')}
                </button>
              )}
              <p className="profile-help-text">
                {t('profile.photo_requirements', { count: MAX_SIZE_MB })}
              </p>
            </div>

            <div className="form-group">
              <label>{t('profile.display_name')}</label>
              <input
                type="text"
                placeholder={t('profile.display_name_placeholder')}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label>{t('profile.biography')}</label>
              <textarea
                placeholder={t('profile.biography_placeholder')}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label>{t('profile.default_location')}</label>
              {(selectedLocation && !locationCleared) ? (
                <div className="profile-location-selected">
                  <span className="profile-location-address">{selectedLocation.address}</span>
                  <button
                    type="button"
                    className="profile-location-clear"
                    onClick={clearLocation}
                    disabled={isSaving}
                  >
                    {t('common.remove')}
                  </button>
                </div>
              ) : (
                <div className="profile-location-search">
                  <input
                    type="text"
                    placeholder={t('profile.search_address_placeholder')}
                    value={locationQuery}
                    onChange={(e) => handleLocationSearch(e.target.value)}
                    disabled={isSaving}
                  />
                  {isSearchingLocation && (
                    <span className="profile-location-searching">{t('common.searching')}</span>
                  )}
                  {locationSuggestions.length > 0 && (
                    <ul className="profile-location-suggestions">
                      {locationSuggestions.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="profile-location-suggestion-item"
                            onClick={() => selectLocation(s)}
                          >
                            {formatEventLocation(s.display_name)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={handleEditToggle}
                disabled={isSaving}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="save-btn"
                disabled={isSaving || (
                  !avatarPreview &&
                  displayName === (profile.display_name ?? '') &&
                  bio === (profile.bio ?? '') &&
                  !locationCleared &&
                  (selectedLocation?.address ?? '') === (profile.default_location_address ?? '')
                )}
              >
                {isSaving ? t('profile.saving') : t('profile.save_profile')}
              </button>
            </div>
          </form>

          {publicProfileSections}

          {changePasswordSection}
        </div>
      )}
    </div>
  );
}
