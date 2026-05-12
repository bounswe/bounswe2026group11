import { useState } from 'react';
import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from '@/services/authService';
import i18n from '@/i18n';

export type ForgotPasswordStep = 'request' | 'verify' | 'reset' | 'success';

interface FieldErrors {
  email?: string;
  otp?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function useForgotPasswordViewModel() {
  const [step, setStep] = useState<ForgotPasswordStep>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetToken, setResetToken] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const validateEmail = (): boolean => {
    setErrors({});
    if (!email) {
      setErrors({ email: i18n.t('validation.email_required') });
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: i18n.t('validation.email_invalid') });
      return false;
    }
    return true;
  };

  const validateOtp = (): boolean => {
    setErrors({});
    if (!otp) {
      setErrors({ otp: i18n.t('validation.otp_required') });
      return false;
    }
    if (otp.length < 6) {
      setErrors({ otp: i18n.t('validation.otp_min_length') });
      return false;
    }
    return true;
  };

  const validatePassword = (): boolean => {
    setErrors({});
    const newErrors: FieldErrors = {};
    if (!newPassword) {
      newErrors.newPassword = i18n.t('validation.password_required');
    } else if (newPassword.length < 8) {
      newErrors.newPassword = i18n.t('validation.password_min');
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = i18n.t('validation.passwords_mismatch');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }
    return true;
  };

  const handleRequestOtp = async (): Promise<boolean> => {
    setApiError(null);
    if (!validateEmail()) return false;

    setIsLoading(true);
    try {
      await requestPasswordResetOtp({ email });
      setStep('verify');
      return true;
    } catch (err: any) {
      setApiError(
        err.response?.data?.error?.message ||
          i18n.t('errors.send_code_failed'),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (): Promise<boolean> => {
    setApiError(null);
    if (!validateOtp()) return false;

    setIsLoading(true);
    try {
      const res = await verifyPasswordResetOtp({ email, otp });
      setResetToken(res.reset_token);
      setStep('reset');
      return true;
    } catch (err: any) {
      setApiError(
        err.response?.data?.error?.message ||
          i18n.t('errors.invalid_verification_code'),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (): Promise<boolean> => {
    setApiError(null);
    if (!validatePassword()) return false;

    setIsLoading(true);
    try {
      await resetPassword({
        email,
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStep('success');
      return true;
    } catch (err: any) {
      setApiError(
        err.response?.data?.error?.message ||
          i18n.t('errors.reset_password_failed'),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    step,
    email,
    setEmail,
    otp,
    setOtp,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isLoading,
    apiError,
    errors,
    handleRequestOtp,
    handleVerifyOtp,
    handleResetPassword,
  };
}
