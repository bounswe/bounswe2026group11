import { useState, useCallback, useEffect } from 'react';
import { UserProfile, UpdateProfileRequest } from '../../models/profile';
import { profileService } from '../../services/profileService';

export function useProfileViewModel(token: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form Draft states
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileService.getMyProfile(token);
      setProfile(data);
      // Pre-fill form values with current profile data
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
      setAvatarUrl(data.avatar_url || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel edit mode: reset draft values back to active profile values
      setDisplayName(profile?.display_name || '');
      setBio(profile?.bio || '');
      setAvatarUrl(profile?.avatar_url || '');
      setError(null);
      setSuccess(null);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    // Minimal frontend validation for URL safety
    if (avatarUrl.trim() && !/^https?:\/\/.+/.test(avatarUrl.trim())) {
      setError("Please enter a valid URL starting with 'http://' or 'https://'");
      setIsSaving(false);
      return;
    }

    try {
      if (!token) throw new Error("Authentication token is missing.");

      const updatePayload: UpdateProfileRequest = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
      };

      await profileService.updateMyProfile(updatePayload, token);
      
      // Re-fetch profile to ensure data consistency with DB
      await fetchProfile();
      
      // Close editing mode on success
      setIsEditing(false);
      setSuccess("Profile updated successfully!");
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
      
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return {
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
  };
}
