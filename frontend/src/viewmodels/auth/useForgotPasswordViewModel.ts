import { useState } from 'react';
import {
  requestPasswordResetOtp,
  verifyPasswordResetOtp,
  resetPassword,
} from '@/services/authService';

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
      setErrors({ email: 'Email is required' });
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setErrors({ email: 'Please enter a valid email address' });
      return false;
    }
    return true;
  };

  const validateOtp = (): boolean => {
    setErrors({});
    if (!otp) {
      setErrors({ otp: 'Verification code is required' });
      return false;
    }
    if (otp.length < 6) {
      setErrors({ otp: 'Code must be at least 6 characters' });
      return false;
    }
    return true;
  };

  const validatePassword = (): boolean => {
    setErrors({});
    const newErrors: FieldErrors = {};
    if (!newPassword) {
      newErrors.newPassword = 'Password is required';
    } else if (newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
          'Failed to send code. Please try again.',
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
          'Invalid verification code. Please try again.',
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
          'Failed to reset password. Please try again.',
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
