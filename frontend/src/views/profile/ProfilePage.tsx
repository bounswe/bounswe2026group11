import '@/styles/profile.css';
import '@/styles/discover.css';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EventCoverImage } from '@/components/EventCoverImage';
import { RatingWithCount } from '@/components/RatingWithCount';
import { useProfileViewModel } from '../../viewmodels/profile/useProfileViewModel';
import type { BadgeCategory, CatalogBadge, EarnedBadge, EventSummary } from '../../models/profile';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';
import { ProfileEquipmentSection, ProfileShowcaseSection } from './ProfilePublicSections';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_MB = 10;

type ProfileHistoryTab = 'hosted' | 'attended';
type PasswordFieldKey = 'current' | 'new' | 'confirm';

const BADGE_CATEGORY_LABELS: Record<BadgeCategory, string> = {
  HOSTING: 'Hosting',
  PARTICIPATION: 'Participation',
  SOCIAL: 'Social',
};

function formatBadgeDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
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
        {!badge.earned && <span className="profile-badge-lock" aria-label="Locked">🔒</span>}
      </span>
      <span className="profile-badge-name">{badge.name}</span>
      <span className="profile-badge-date">
        {badge.earned_at ? formatBadgeDate(badge.earned_at) : 'Not earned'}
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
  return (
    <div className="profile-badge-modal-card" role="dialog" aria-modal="true" aria-labelledby="profile-badge-detail-title">
      <div className="profile-badge-modal-header">
        {onBack ? (
          <button type="button" className="profile-badge-modal-text-btn" onClick={onBack}>
            Back
          </button>
        ) : (
          <span className="profile-badge-modal-spacer" aria-hidden />
        )}
        <h2 id="profile-badge-detail-title" className="profile-badge-modal-title">Badge details</h2>
        <button type="button" className="profile-badge-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className={`profile-badge-detail ${badge.earned ? 'earned' : 'locked'}`}>
        <span className="profile-badge-detail-icon">
          <BadgeIcon badge={badge} />
          {!badge.earned && <span className="profile-badge-lock detail" aria-label="Locked">🔒</span>}
        </span>
        <h3>{badge.name}</h3>
        <p className="profile-badge-detail-category">{BADGE_CATEGORY_LABELS[badge.category] ?? badge.category}</p>
        <p className="profile-badge-detail-description">{badge.description}</p>
        <p className="profile-badge-detail-status">
          {badge.earned_at
            ? `Earned ${formatBadgeDate(badge.earned_at)}`
            : `Not yet earned. ${badge.description}`}
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
        <h2 id="profile-badge-catalog-title" className="profile-badge-modal-title">All Badges</h2>
        <button type="button" className="profile-badge-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      <div className="profile-badge-tabs" role="tablist" aria-label="Badge categories">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            className={`profile-badge-tab ${activeCategory === category ? 'active' : ''}`}
            onClick={() => onCategoryChange(category)}
          >
            {category === 'ALL' ? 'All' : BADGE_CATEGORY_LABELS[category]}
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
        <div className="profile-badges-empty">No badges in this category yet.</div>
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
          <h2 className="profile-badges-title">Badges</h2>
          <p className="profile-badges-subtitle">Achievements earned through hosting, participation, and social activity</p>
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
          View All Badges
        </button>
      </div>

      {badgesLoading ? (
        <div className="profile-badges-state">Loading badges...</div>
      ) : badgeError ? (
        <div className="profile-badges-state error">
          <span>{badgeError}</span>
          <button type="button" onClick={onRetry}>Retry</button>
        </div>
      ) : badgesForPreview.length > 0 ? (
        <div className="profile-badges-row" aria-label="Profile badges">
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
        <div className="profile-badges-empty">No badges available yet.</div>
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

function ProfileHistoryCard({ event }: { event: EventSummary }) {
  const lifecycle = getEventLifecyclePresentation(event.status);
  const category = event.category_name ?? event.category ?? 'Event';

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
            {event.privacy_level === 'PUBLIC' ? 'Public' : 'Protected'}
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
            {event.approved_participant_count ?? 0} participant{event.approved_participant_count === 1 ? '' : 's'}
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
          <h2 className="change-password-title">Change Password</h2>
          <p className="change-password-subtitle">Update your account password without changing profile details.</p>
        </div>
        <button
          type="button"
          className="change-password-toggle"
          onClick={togglePasswordForm}
          disabled={isChangingPassword}
          aria-expanded={isPasswordFormOpen}
        >
          {isPasswordFormOpen ? 'Close' : 'Change Password'}
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
            <label htmlFor="current-password">Current password</label>
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
                {visiblePasswords.current ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordErrors.currentPassword && (
              <p className="field-error">{passwordErrors.currentPassword}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="new-password">New password</label>
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
                {visiblePasswords.new ? 'Hide' : 'Show'}
              </button>
            </div>
            {passwordErrors.newPassword && (
              <p className="field-error">{passwordErrors.newPassword}</p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="confirm-new-password">Confirm new password</label>
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
                {visiblePasswords.confirm ? 'Hide' : 'Show'}
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
              Cancel
            </button>
            <button
              type="submit"
              className="save-btn"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function ProfilePage() {
  const { token } = useAuth();
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const showcaseInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return handleFileChange(null);
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File must be smaller than ${MAX_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }
    handleFileChange(file);
  };

  const onShowcaseFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      alert(`File must be smaller than ${MAX_SIZE_MB} MB.`);
      e.target.value = '';
      return;
    }
    void handleShowcaseUpload(file);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="profile-container" style={{ textAlign: 'center' }}>
        <p>Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container" style={{ textAlign: 'center' }}>
        <p>User profile could not be loaded.</p>
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
        <p>Loading equipment and showcase...</p>
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
            Add Equipment
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
              Edit
            </button>
            <button
              type="button"
              className="profile-inline-btn danger"
              onClick={() => {
                if (window.confirm('Delete this equipment item?')) {
                  void handleDeleteEquipment(item.id);
                }
              }}
              disabled={equipmentSubmitting || equipmentDeletingId === item.id}
            >
              {equipmentDeletingId === item.id ? 'Deleting...' : 'Delete'}
            </button>
          </>
        )}
        emptyMessage="You have not added any equipment yet."
      />

      {equipmentError ? (
        <div className="profile-section-feedback error" role="alert">
          {equipmentError}
        </div>
      ) : null}

      {isEquipmentEditorOpen ? (
        <form className="profile-inline-form" onSubmit={handleEquipmentSubmit}>
          <div className="profile-inline-form-header">
            <h3>{equipmentDraft.id ? 'Edit equipment' : 'Add equipment'}</h3>
            <p>Share the gear you want other members to see on your profile.</p>
          </div>

          <div className="form-group">
            <label htmlFor="equipment-name">Name</label>
            <input
              id="equipment-name"
              type="text"
              value={equipmentDraft.name}
              onChange={(e) => updateEquipmentDraft('name', e.target.value)}
              maxLength={64}
              placeholder="Trail shoes, hydration pack, climbing rope..."
              disabled={equipmentSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="equipment-description">Description</label>
            <textarea
              id="equipment-description"
              value={equipmentDraft.description}
              onChange={(e) => updateEquipmentDraft('description', e.target.value)}
              maxLength={512}
              placeholder="Add a short note about fit, terrain, or why this item matters to you."
              disabled={equipmentSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="equipment-image">Image URL</label>
            <input
              id="equipment-image"
              type="url"
              value={equipmentDraft.imageUrl}
              onChange={(e) => updateEquipmentDraft('imageUrl', e.target.value)}
              placeholder="https://example.com/gear.jpg"
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
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={equipmentSubmitting}>
              {equipmentSubmitting ? 'Saving...' : equipmentDraft.id ? 'Save Changes' : 'Add Equipment'}
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
            {showcaseUploading ? 'Uploading...' : 'Upload Image'}
          </button>
        )}
        imageActions={(image) => (
          <button
            type="button"
            className="profile-showcase-remove"
            onClick={() => {
              if (window.confirm('Remove this showcase image?')) {
                void handleDeleteShowcaseImage(image.id);
              }
            }}
            disabled={showcaseRemovingId === image.id}
            aria-label="Remove showcase image"
          >
            {showcaseRemovingId === image.id ? 'Removing...' : 'Remove'}
          </button>
        )}
        emptyMessage="You have not uploaded any showcase images yet."
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
          Retry
        </button>
      </div>
    </section>
  );

  return (
    <div className="profile-container profile-container-wide">
      <div className="profile-header">
        <h1>Your Profile</h1>
        <button
          className="edit-toggle-btn"
          onClick={handleEditToggle}
          disabled={isSaving}
        >
          {isEditing ? 'Cancel Edit' : 'Edit Profile'}
        </button>
      </div>

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
            alt="Profile Avatar"
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
            <label>Username</label>
            <p>@{profile.username}</p>
          </div>
          <div className="info-group">
            <label>Email</label>
            <p>
              {profile.email}
              <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: profile.email_verified ? 'green' : 'gray' }}>
                ({profile.email_verified ? 'Verified' : 'Unverified'})
              </span>
            </p>
          </div>
          <div className="info-group">
            <label>Display Name</label>
            {profile.display_name ? <p>{profile.display_name}</p> : <p className="empty-state">No display name set</p>}
          </div>
          <div className="info-group">
            <label>Bio</label>
            {profile.bio ? <p>{profile.bio}</p> : <p className="empty-state">No bio provided</p>}
          </div>
          <div className="info-group">
            <label>Default Location</label>
            {profile.default_location_address ? (
              <p>{formatEventLocation(profile.default_location_address)}</p>
            ) : (
              <p className="empty-state">No default location set</p>
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
            <h2 className="profile-history-title">Participation History</h2>
            <p className="profile-history-subtitle">Hosted events and the events you attended</p>
          </div>

          <div className="profile-history-tabs">
            <button
              type="button"
              className={`profile-history-tab ${activeHistoryTab === 'hosted' ? 'active' : ''}`}
              onClick={() => setActiveHistoryTab('hosted')}
            >
              Hosted <span className="profile-history-tab-count">{hostedEvents.length}</span>
            </button>
            <button
              type="button"
              className={`profile-history-tab ${activeHistoryTab === 'attended' ? 'active' : ''}`}
              onClick={() => setActiveHistoryTab('attended')}
            >
              Attended <span className="profile-history-tab-count">{attendedEvents.length}</span>
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
              <p className="profile-history-empty-title">No {activeHistoryTab} events yet</p>
              <p className="profile-history-empty-subtitle">
                {activeHistoryTab === 'hosted'
                  ? 'Events you create will show up here.'
                  : 'Events you join will show up here.'}
              </p>
            </div>
          )}
        </section>
        </>
      ) : (
        <div className="profile-form">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Profile Photo</label>
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
                {avatarPreview ? 'Change Photo' : 'Upload Photo'}
              </button>
              {avatarPreview && (
                <button
                  type="button"
                  className="cancel-btn"
                  style={{ marginLeft: '0.5rem' }}
                  onClick={() => { handleFileChange(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  disabled={isSaving}
                >
                  Remove
                </button>
              )}
              <p className="profile-help-text">
                JPG, PNG or WebP · Max {MAX_SIZE_MB} MB
              </p>
            </div>

            <div className="form-group">
              <label>Display Name</label>
              <input
                type="text"
                placeholder="Enter your public display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={50}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label>Biography</label>
              <textarea
                placeholder="Tell us a bit about yourself"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={500}
                disabled={isSaving}
              />
            </div>

            <div className="form-group">
              <label>Default Location</label>
              {(selectedLocation && !locationCleared) ? (
                <div className="profile-location-selected">
                  <span className="profile-location-address">{selectedLocation.address}</span>
                  <button
                    type="button"
                    className="profile-location-clear"
                    onClick={clearLocation}
                    disabled={isSaving}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="profile-location-search">
                  <input
                    type="text"
                    placeholder="Search for an address..."
                    value={locationQuery}
                    onChange={(e) => handleLocationSearch(e.target.value)}
                    disabled={isSaving}
                  />
                  {isSearchingLocation && (
                    <span className="profile-location-searching">Searching...</span>
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
                Cancel
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
                {isSaving ? 'Saving...' : 'Save Profile'}
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
