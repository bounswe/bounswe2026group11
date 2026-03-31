import '@/styles/profile.css';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileViewModel } from '../../viewmodels/profile/useProfileViewModel';

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
    avatarUrl,
    setAvatarUrl,
    handleEditToggle,
    handleSave,
  } = useProfileViewModel(token);

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

      {/* Avatar Preview Section used in both Read Only and Edit modes */}
      <div className="avatar-preview">
        {avatarUrl || profile.avatar_url ? (
          <img
            src={isEditing ? avatarUrl : profile.avatar_url!}
            alt="Profile Avatar"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/120?text=Invalid+Image'; }}
          />
        ) : (
          <div className="avatar-placeholder">
            {profile.display_name ? profile.display_name.charAt(0).toUpperCase() : profile.username.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {!isEditing ? (
        // READ-ONLY STATE
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
        // EDIT MODE STATE
        <div className="profile-form">
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>Avatar Image URL</label>
              <input
                type="text"
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                disabled={isSaving}
              />
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
                disabled={isSaving || (displayName === profile.display_name && bio === profile.bio && avatarUrl === profile.avatar_url)}
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
