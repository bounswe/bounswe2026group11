import { useState, useCallback } from 'react';
import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from '@/services/authService';
import { ApiError } from '@/services/api';
import { validateEmail, validateOtp, validatePassword } from '@/utils/validators';

export type ForgotPasswordStep = 'email' | 'otp' | 'reset';

export interface ForgotPasswordFormData {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ForgotPasswordFormErrors {
  email?: string | null;
  otp?: string | null;
  newPassword?: string | null;
}

export interface ForgotPasswordViewModel {
  step: ForgotPasswordStep;
  formData: ForgotPasswordFormData;
  errors: ForgotPasswordFormErrors;
  isLoading: boolean;
  apiError: string | null;
  successMessage: string | null;
  handleRequestOtp: () => Promise<void>;
  handleVerifyOtp: () => Promise<void>;
  handleResetPassword: () => Promise<boolean>;
  updateField: <K extends keyof ForgotPasswordFormData>(
    field: K,
    value: ForgotPasswordFormData[K],
  ) => void;
  goBack: () => void;
}

const INITIAL_FORM_DATA: ForgotPasswordFormData = {
  email: '',
  otp: '',
  newPassword: '',
};

const OTP_ERROR_CODES = new Set(['invalid_otp', 'otp_attempts_exceeded']);

export function useForgotPasswordViewModel(): ForgotPasswordViewModel {
  const [step, setStep] = useState<ForgotPasswordStep>('email');
  const [formData, setFormData] =
    useState<ForgotPasswordFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<ForgotPasswordFormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const updateField = useCallback(
    <K extends keyof ForgotPasswordFormData>(
      field: K,
      value: ForgotPasswordFormData[K],
    ) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => ({ ...prev, [field]: null }));
      setApiError(null);
    },
    [],
  );

  const handleRequestOtp = useCallback(async () => {
    const trimmedEmail = formData.email.trim();
    const emailError = validateEmail(trimmedEmail);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      await requestPasswordResetOtp({ email: trimmedEmail });
      setFormData((prev) => ({ ...prev, email: trimmedEmail }));
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
  }, [formData.email]);

  const handleVerifyOtp = useCallback(async () => {
    const otpError = validateOtp(formData.otp);
    if (otpError) {
      setErrors((prev) => ({ ...prev, otp: otpError }));
      return;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const grant = await verifyPasswordResetOtp({
        email: formData.email,
        otp: formData.otp,
      });
      setResetToken(grant.reset_token);
      setStep('reset');
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
    } finally {
      setIsLoading(false);
    }
  }, [formData.email, formData.otp]);

  const handleResetPassword = useCallback(async (): Promise<boolean> => {
    const passwordError = validatePassword(formData.newPassword);
    if (passwordError) {
      setErrors((prev) => ({ ...prev, newPassword: passwordError }));
      return false;
    }

    if (!resetToken) {
      setApiError('Reset session expired. Please start over.');
      return false;
    }

    setIsLoading(true);
    setApiError(null);
    try {
      const result = await resetPassword({
        email: formData.email,
        reset_token: resetToken,
        new_password: formData.newPassword,
      });
      setSuccessMessage(result.message);
      return true;
    } catch (err) {
      if (err instanceof ApiError) {
        setApiError(err.message);
      } else {
        setApiError('An unexpected error occurred. Please try again.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [formData.email, formData.newPassword, resetToken]);

  const goBack = useCallback(() => {
    setApiError(null);
    setErrors({});
    if (step === 'otp') {
      setFormData((prev) => ({ ...prev, otp: '' }));
      setStep('email');
    } else if (step === 'reset') {
      setFormData((prev) => ({ ...prev, otp: '', newPassword: '' }));
      setResetToken(null);
      setStep('otp');
    }
  }, [step]);

  return {
    step,
    formData,
    errors,
    isLoading,
    apiError,
    successMessage,
    handleRequestOtp,
    handleVerifyOtp,
    handleResetPassword,
    updateField,
    goBack,
  };
}
