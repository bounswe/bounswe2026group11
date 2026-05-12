/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import ForgotPasswordView from './ForgotPasswordView';
import {
  useForgotPasswordViewModel,
  type ForgotPasswordViewModel,
} from '@/viewmodels/auth/useForgotPasswordViewModel';

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
  };
});

jest.mock('@expo/vector-icons', () => {
  const ReactLocal = require('react');
  return {
    Ionicons: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

jest.mock('@/viewmodels/auth/useForgotPasswordViewModel', () => ({
  useForgotPasswordViewModel: jest.fn(),
}));

const mockUseForgotPasswordViewModel = jest.mocked(useForgotPasswordViewModel);

function buildViewModel(
  overrides: Partial<ForgotPasswordViewModel> = {},
): ForgotPasswordViewModel {
  return {
    step: 'email',
    formData: {
      email: '',
      otp: '',
      newPassword: '',
      confirmNewPassword: '',
    },
    errors: {},
    isLoading: false,
    apiError: null,
    successMessage: null,
    handleRequestOtp: jest.fn().mockResolvedValue(undefined),
    handleVerifyOtp: jest.fn().mockResolvedValue(undefined),
    handleResetPassword: jest.fn().mockResolvedValue(false),
    updateField: jest.fn(),
    goBack: jest.fn(),
    ...overrides,
  };
}

describe('ForgotPasswordView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseForgotPasswordViewModel.mockReturnValue(buildViewModel());
  });

  it('renders the email step, updates email, and submits OTP request', () => {
    const updateField = jest.fn();
    const handleRequestOtp = jest.fn().mockResolvedValue(undefined);
    mockUseForgotPasswordViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        handleRequestOtp,
        apiError: 'Could not send a reset code.',
        errors: {
          email: 'Email is required.',
        },
      }),
    );

    render(<ForgotPasswordView />);

    expect(screen.getByText('Forgot password')).toBeTruthy();
    expect(screen.getByText('Could not send a reset code.')).toBeTruthy();
    expect(screen.getByText('Email is required.')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'maplover@example.com' },
    });
    fireEvent.click(screen.getByText('Send reset code'));

    expect(updateField).toHaveBeenCalledWith('email', 'maplover@example.com');
    expect(handleRequestOtp).toHaveBeenCalledTimes(1);
  });

  it('routes back to sign in from the email step', () => {
    render(<ForgotPasswordView />);

    fireEvent.click(screen.getByText('Back to Sign In'));

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('edits OTP, verifies it, and returns to email when requested', () => {
    const updateField = jest.fn();
    const handleVerifyOtp = jest.fn().mockResolvedValue(undefined);
    const goBack = jest.fn();
    mockUseForgotPasswordViewModel.mockReturnValue(
      buildViewModel({
        step: 'otp',
        updateField,
        handleVerifyOtp,
        goBack,
        errors: {
          otp: 'Verification code is required.',
        },
      }),
    );

    render(<ForgotPasswordView />);

    expect(screen.getByText('Verification code is required.')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('123456'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByText('Verify code'));
    fireEvent.click(screen.getByText('Go Back'));

    expect(updateField).toHaveBeenCalledWith('otp', '654321');
    expect(handleVerifyOtp).toHaveBeenCalledTimes(1);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('resets the password and navigates to sign in on success', async () => {
    const updateField = jest.fn();
    const handleResetPassword = jest.fn().mockResolvedValue(true);
    mockUseForgotPasswordViewModel.mockReturnValue(
      buildViewModel({
        step: 'reset',
        updateField,
        handleResetPassword,
      }),
    );

    render(<ForgotPasswordView />);

    expect(screen.getByText('Confirm New Password')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Show /).length).toBe(2);

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.change(screen.getByPlaceholderText('Confirm new password'), {
      target: { value: 'NewPassword1' },
    });
    fireEvent.click(screen.getByLabelText('Show New Password'));

    expect(screen.getByLabelText('Hide New Password')).toBeTruthy();
    expect(screen.getAllByLabelText(/^Show /).length).toBe(1);

    fireEvent.click(screen.getByLabelText('Hide New Password'));

    expect(screen.getAllByLabelText(/^Show /).length).toBe(2);

    fireEvent.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(updateField).toHaveBeenCalledWith('newPassword', 'NewPassword1');
      expect(updateField).toHaveBeenCalledWith(
        'confirmNewPassword',
        'NewPassword1',
      );
      expect(handleResetPassword).toHaveBeenCalledTimes(1);
      expect(router.replace).toHaveBeenCalledWith('/');
    });
  });

  it('keeps the user on reset step when password reset fails', async () => {
    const handleResetPassword = jest.fn().mockResolvedValue(false);
    mockUseForgotPasswordViewModel.mockReturnValue(
      buildViewModel({
        step: 'reset',
        handleResetPassword,
        apiError: 'Reset session expired. Please start over.',
        successMessage: 'Password has been reset.',
      }),
    );

    render(<ForgotPasswordView />);

    expect(
      screen.getByText('Reset session expired. Please start over.'),
    ).toBeTruthy();
    expect(screen.getByText('Password has been reset.')).toBeTruthy();

    fireEvent.click(screen.getByText('Reset password'));

    await waitFor(() => {
      expect(handleResetPassword).toHaveBeenCalledTimes(1);
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('disables the active input and shows progress while loading', () => {
    const handleRequestOtp = jest.fn().mockResolvedValue(undefined);
    mockUseForgotPasswordViewModel.mockReturnValue(
      buildViewModel({
        handleRequestOtp,
        isLoading: true,
      }),
    );

    render(<ForgotPasswordView />);

    expect(
      (screen.getByPlaceholderText('you@example.com') as HTMLInputElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByRole('progressbar')).toBeTruthy();

    fireEvent.click(screen.getByRole('progressbar'));
    fireEvent.click(screen.getByText('Back to Sign In'));

    expect(handleRequestOtp).not.toHaveBeenCalled();
    expect(router.back).not.toHaveBeenCalled();
  });
});
