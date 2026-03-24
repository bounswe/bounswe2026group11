import { useState, useCallback } from 'react';
import {
  checkRegistrationAvailability,
  requestRegistrationOtp,
  verifyRegistration,
} from '@/services/authService';
import { AuthSessionResponse } from '@/models/auth';
import { ApiError } from '@/services/api';
import {
  validateEmail,
  validateOtp,
  validateUsername,
  validatePassword,
  validatePhoneNumber,
  validateBirthDate,
} from '@/utils/validators';

export type RegisterStep = 'details' | 'otp';

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say' | '';

export interface RegisterFormData {
  email: string;
  otp: string;
  username: string;
  password: string;
  phone_number: string;
  gender: Gender;
  birth_date: string;
}

export interface RegisterFormErrors {
  email?: string | null;
  otp?: string | null;
  username?: string | null;
  password?: string | null;
  phone_number?: string | null;
  birth_date?: string | null;
}

export interface RegisterViewModel {
  step: RegisterStep;
  formData: RegisterFormData;
  errors: RegisterFormErrors;
  isLoading: boolean;
  apiError: string | null;
  updateField: <K extends keyof RegisterFormData>(
    field: K,
    value: RegisterFormData[K],
  ) => void;
  handleSubmitDetails: () => Promise<void>;
  handleVerifyOtp: () => Promise<AuthSessionResponse | null>;
  goBack: () => void;
}

const INITIAL_FORM_DATA: RegisterFormData = {
  email: '',
  otp: '',
  username: '',
  password: '',
  phone_number: '',
  gender: '',
  birth_date: '',
};

const OTP_ERROR_CODES = new Set(['invalid_otp', 'otp_attempts_exceeded']);

export function useRegisterViewModel(): RegisterViewModel {
  const [step, setStep] = useState<RegisterStep>('details');
  const [formData, setFormData] = useState<RegisterFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<RegisterFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof RegisterFormData>(field: K, value: RegisterFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: null }));
      setApiError(null);
    },
    [],
  );

  const handleSubmitDetails = useCallback(async () => {
    const newErrors: RegisterFormErrors = {
      email: validateEmail(formData.email),
      username: validateUsername(formData.username),
      password: validatePassword(formData.password),
      phone_number: validatePhoneNumber(formData.phone_number),
      birth_date: validateBirthDate(formData.birth_date),
    };

    const hasErrors = Object.values(newErrors).some((e) => e != null);
    if (hasErrors) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const availability = await checkRegistrationAvailability({
        username: formData.username,
        email: formData.email,
      });
      const taken: RegisterFormErrors = {};
      if (availability.email === 'TAKEN') {
        taken.email = 'This email is already in use.';
      }
      if (availability.username === 'TAKEN') {
        taken.username = 'This username is already in use.';
      }
      if (Object.keys(taken).length > 0) {
        setErrors((prev) => ({ ...prev, ...taken }));
        return;
      }

      await requestRegistrationOtp({ email: formData.email });
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData]);

  const handleVerifyOtp = useCallback(async (): Promise<AuthSessionResponse | null> => {
    const otpError = validateOtp(formData.otp);
    if (otpError) {
      setErrors((prev) => ({ ...prev, otp: otpError }));
      return null;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      return await verifyRegistration({
        email: formData.email,
        otp: formData.otp,
        username: formData.username,
        password: formData.password,
        phone_number: formData.phone_number || null,
        gender: formData.gender || null,
        birth_date: formData.birth_date || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        if (OTP_ERROR_CODES.has(err.code)) {
          setFormData((prev) => ({ ...prev, otp: '' }));
          setErrors({ otp: err.message });
        }
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [formData]);

  const goBack = useCallback(() => {
    setApiError(null);
    setErrors({});
    if (step === 'otp') setStep('details');
  }, [step]);

  return {
    step,
    formData,
    errors,
    isLoading,
    apiError,
    updateField,
    handleSubmitDetails,
    handleVerifyOtp,
    goBack,
  };
}
