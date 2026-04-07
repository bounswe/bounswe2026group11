import '@/styles/profile.css';
import '@/styles/discover.css';
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EventCoverImage } from '@/components/EventCoverImage';
import { useProfileViewModel } from '../../viewmodels/profile/useProfileViewModel';
import type { EventSummary } from '../../models/profile';
import { getEventLifecyclePresentation } from '@/utils/eventStatus';
import { formatEventLocation } from '@/utils/eventLocation';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_MB = 10;

type ProfileHistoryTab = 'hosted' | 'attended';

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
          {event.host_score?.final_score != null && (
            <span className="dc-card-score">
              {'★'} {event.host_score.final_score.toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const { token } = useAuth();
  const {
    profile,
    hostedEvents,
    attendedEvents,
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
  } = useProfileViewModel(token);
  const [activeHistoryTab, setActiveHistoryTab] = useState<ProfileHistoryTab>('hosted');

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="profile-container">
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
        <div className="form-error" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: '6px' }}>
          {error}
        </div>
      )}

      {success && (
        <div className="form-success" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', borderRadius: '6px', fontWeight: '500' }}>
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
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.4rem' }}>
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
        </div>
      )}
    </div>
  );
}
