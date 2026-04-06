import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserProfile, UpdateProfileRequest } from '../../models/profile';
import { profileService } from '../../services/profileService';
import { prepareAvatarBlobs } from '../../utils/imageResize';

export function useProfileViewModel(token: string | null) {
  const { setProfileSummary } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // UI states
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Form Draft states
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await profileService.getMyProfile(token);
      setProfile(data);
      setDisplayName(data.display_name || '');
      setBio(data.bio || '');
      setProfileSummary({
        avatarUrl: data.avatar_url ?? null,
        displayName: data.display_name ?? null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [token, setProfileSummary]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(
    () => () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    },
    [],
  );

  const handleFileChange = useCallback((file: File | null) => {
    setAvatarFile(file);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(file ? URL.createObjectURL(file) : null);
  }, [avatarPreview]);

  const handleEditToggle = () => {
    if (isEditing) {
      setDisplayName(profile?.display_name || '');
      setBio(profile?.bio || '');
      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
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

    try {
      if (!token) throw new Error('Authentication token is missing.');

      const hadAvatarUpload = !!avatarFile;

      if (avatarFile) {
        const { original, small } = await prepareAvatarBlobs(avatarFile);
        const uploadInit = await profileService.getAvatarUploadUrl(token);

        for (const instruction of uploadInit.uploads) {
          const blob = instruction.variant === 'ORIGINAL' ? original : small;
          const res = await fetch(instruction.url, {
            method: instruction.method,
            headers: instruction.headers,
            body: blob,
          });
          if (!res.ok) throw new Error(`Image upload failed (${instruction.variant})`);
        }

        await profileService.confirmAvatarUpload(
          { confirm_token: uploadInit.confirm_token },
          token,
        );
      }

      const updatePayload: UpdateProfileRequest = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
      };

      await profileService.updateMyProfile(updatePayload, token);
      await fetchProfile();

      setAvatarFile(null);
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setIsEditing(false);
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
      const message = hadAvatarUpload
        ? 'Profile photo updated successfully!'
        : 'Profile updated successfully!';
      setSuccess(message);
      successTimerRef.current = setTimeout(() => {
        setSuccess(null);
        successTimerRef.current = null;
      }, 5000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
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
    avatarPreview,
    handleFileChange,
    handleEditToggle,
    handleSave,
  };
}
