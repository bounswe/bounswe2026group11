import { useState, useCallback } from 'react';
import { login } from '@/services/authService';
import { AuthSessionResponse } from '@/models/auth';
import { ApiError } from '@/services/api';
import { validateUsername, validatePassword } from '@/utils/validators';

export interface LoginFormData {
  username: string;
  password: string;
}

export interface LoginFormErrors {
  username?: string | null;
  password?: string | null;
}

const INITIAL_FORM_DATA: LoginFormData = {
  username: '',
  password: '',
};

export function useLoginViewModel() {
  const [formData, setFormData] = useState<LoginFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof LoginFormData>(field: K, value: LoginFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: null }));
      setApiError(null);
    },
    [],
  );

  const handleLogin = useCallback(async (): Promise<AuthSessionResponse | null> => {
    const newErrors: LoginFormErrors = {
      username: validateUsername(formData.username),
      password: validatePassword(formData.password),
    };

    const hasErrors = Object.values(newErrors).some((e) => e != null);
    if (hasErrors) {
      setErrors(newErrors);
      return null;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      return await login({
        username: formData.username,
        password: formData.password,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [formData]);

  return {
    formData,
    errors,
    isLoading,
    apiError,
    updateField,
    handleLogin,
  };
}
