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
import i18n from '@/i18n';
import { getAuthApiErrorMessage, getAuthApiFieldErrors } from '@/utils/authErrorPresentation';

export type RegisterStep = 'details' | 'otp';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | '';

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
  gender?: string | null;
  birth_date?: string | null;
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

function validateRequiredGender(gender: Gender): string | null {
  return gender ? null : i18n.t('validation.gender_required');
}

function validateRequiredBirthDate(date: string): string | null {
  if (!date.trim()) return i18n.t('validation.birth_date_required');
  return validateBirthDate(date);
}

export function useRegisterViewModel() {
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
      gender: validateRequiredGender(formData.gender),
      birth_date: validateRequiredBirthDate(formData.birth_date),
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
        taken.email = i18n.t('errors.email_in_use');
      }
      if (availability.username === 'TAKEN') {
        taken.username = i18n.t('errors.username_in_use');
      }
      if (Object.keys(taken).length > 0) {
        setErrors((prev) => ({ ...prev, ...taken }));
        return;
      }

      await requestRegistrationOtp({ email: formData.email });
      setStep('otp');
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = getAuthApiFieldErrors(err);
        if (Object.keys(fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...fieldErrors }));
          setApiError(null);
        } else {
          setApiError(getAuthApiErrorMessage(err));
        }
      } else {
        setApiError(i18n.t('errors.unexpected'));
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
        const localizedMessage = getAuthApiErrorMessage(err);
        const fieldErrors = getAuthApiFieldErrors(err);
        if (OTP_ERROR_CODES.has(err.code)) {
          setFormData((prev) => ({ ...prev, otp: '' }));
          setErrors({ otp: localizedMessage });
          setApiError(null);
          return null;
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors((prev) => ({ ...prev, ...fieldErrors }));
          setApiError(null);
        } else {
          setApiError(localizedMessage);
        }
      } else {
        setApiError(i18n.t('errors.unexpected'));
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
