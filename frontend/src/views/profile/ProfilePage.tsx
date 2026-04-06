import '@/styles/profile.css';
import { useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileViewModel } from '../../viewmodels/profile/useProfileViewModel';

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_SIZE_MB = 10;

export default function ProfilePage() {
  const { token } = useAuth();
  const {
    profile,
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
  } = useProfileViewModel(token);

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
        </div>
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
                  bio === (profile.bio ?? '')
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
