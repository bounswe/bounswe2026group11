import { useState, useCallback } from 'react';
import { changePassword } from '@/services/profileService';
import { ApiError } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { validatePassword } from '@/utils/validators';

export interface ChangePasswordFormData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordFormErrors {
  currentPassword?: string | null;
  newPassword?: string | null;
  confirmPassword?: string | null;
}

export interface ChangePasswordViewModel {
  formData: ChangePasswordFormData;
  errors: ChangePasswordFormErrors;
  isLoading: boolean;
  apiError: string | null;
  successMessage: string | null;
  updateField: <K extends keyof ChangePasswordFormData>(
    field: K,
    value: string,
  ) => void;
  handleSubmit: () => Promise<boolean>;
}

export function useChangePasswordViewModel(): ChangePasswordViewModel {
  const { token } = useAuth();
  const [formData, setFormData] = useState<ChangePasswordFormData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<ChangePasswordFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof ChangePasswordFormData>(field: K, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: null }));
      setApiError(null);
      setSuccessMessage(null);
    },
    [],
  );

  const handleSubmit = useCallback(async (): Promise<boolean> => {
    // Client-side validation
    const newErrors: ChangePasswordFormErrors = {
      currentPassword: !formData.currentPassword ? 'Current password is required.' : null,
      newPassword: validatePassword(formData.newPassword),
      confirmPassword: !formData.confirmPassword ? 'Please confirm your new password.' : null,
    };

    if (!newErrors.confirmPassword && formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!newErrors.newPassword && formData.currentPassword === formData.newPassword) {
      newErrors.newPassword = 'New password must be different from current password.';
    }

    const hasErrors = Object.values(newErrors).some((e) => e != null);
    if (hasErrors) {
      setErrors(newErrors);
      return false;
    }

    if (!token) {
      setApiError('You must be logged in to change your password.');
      return false;
    }

    setIsLoading(true);
    setApiError(null);
    setSuccessMessage(null);

    try {
      await changePassword(formData.currentPassword, formData.newPassword, token);
      setSuccessMessage('Password changed successfully.');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 403) {
          setErrors((prev) => ({ ...prev, currentPassword: 'Current password is incorrect.' }));
        } else {
          setApiError(err.message);
        }
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formData, token]);

  return {
    formData,
    errors,
    isLoading,
    apiError,
    successMessage,
    updateField,
    handleSubmit,
  };
}
