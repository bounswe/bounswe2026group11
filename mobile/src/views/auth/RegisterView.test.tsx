/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import RegisterView from './RegisterView';
import { useAuth } from '@/contexts/AuthContext';
import {
  useRegisterViewModel,
  type RegisterViewModel,
} from '@/viewmodels/auth/useRegisterViewModel';
import type { AuthSessionResponse } from '@/models/auth';

jest.mock('react-native-safe-area-context', () => {
  const ReactLocal = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement('div', null, children),
  };
});

jest.mock('@/components/common/SemLogo', () => {
  const ReactLocal = require('react');
  return () => ReactLocal.createElement('div', { 'data-testid': 'SemLogo' });
});

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/viewmodels/auth/useRegisterViewModel', () => ({
  useRegisterViewModel: jest.fn(),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockUseRegisterViewModel = jest.mocked(useRegisterViewModel);

const session: AuthSessionResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'Bearer',
  expires_in_seconds: 3600,
  user: {
    id: 'user-1',
    username: 'maplover',
    email: 'maplover@example.com',
    phone_number: null,
    email_verified: true,
    status: 'ACTIVE',
  },
};

function buildViewModel(
  overrides: Partial<RegisterViewModel> = {},
): RegisterViewModel {
  return {
    step: 'details',
    formData: {
      email: '',
      otp: '',
      username: '',
      password: '',
      phone_number: '',
      gender: '',
      birth_date: '',
    },
    errors: {},
    isLoading: false,
    apiError: null,
    updateField: jest.fn(),
    handleSubmitDetails: jest.fn().mockResolvedValue(undefined),
    handleVerifyOtp: jest.fn().mockResolvedValue(null),
    goBack: jest.fn(),
    ...overrides,
  };
}

describe('RegisterView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      setSession: jest.fn().mockResolvedValue(undefined),
    } as any);
    mockUseRegisterViewModel.mockReturnValue(buildViewModel());
  });

  it('renders account details and updates fields from user input', () => {
    const updateField = jest.fn();
    const handleSubmitDetails = jest.fn().mockResolvedValue(undefined);
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        handleSubmitDetails,
        apiError: 'Email is already in use.',
        errors: {
          email: 'Invalid email.',
          gender: 'Gender is required.',
        },
      }),
    );

    render(<RegisterView />);

    expect(screen.getByTestId('SemLogo')).toBeTruthy();
    expect(screen.getByText('Create Account')).toBeTruthy();
    expect(screen.getByText('Email is already in use.')).toBeTruthy();
    expect(screen.getByText('Invalid email.')).toBeTruthy();
    expect(screen.getByText('Gender is required.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'maplover@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'maplover' },
    });
    fireEvent.click(screen.getByLabelText('Gender Male'));
    fireEvent.click(screen.getByLabelText('Continue'));

    expect(updateField).toHaveBeenNthCalledWith(
      1,
      'email',
      'maplover@example.com',
    );
    expect(updateField).toHaveBeenNthCalledWith(2, 'username', 'maplover');
    expect(updateField).toHaveBeenNthCalledWith(3, 'gender', 'MALE');
    expect(handleSubmitDetails).toHaveBeenCalledTimes(1);
  });

  it('lets users clear a selected gender chip', () => {
    const updateField = jest.fn();
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        formData: {
          ...buildViewModel().formData,
          gender: 'MALE',
        },
      }),
    );

    render(<RegisterView />);

    fireEvent.click(screen.getByLabelText('Gender Male'));

    expect(updateField).toHaveBeenCalledWith('gender', '');
  });

  it('verifies OTP, stores the session, and navigates home', async () => {
    const handleVerifyOtp = jest.fn().mockResolvedValue(session);
    const setSession = jest.fn().mockResolvedValue(undefined);
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({
        step: 'otp',
        formData: {
          ...buildViewModel().formData,
          otp: '123456',
        },
        handleVerifyOtp,
      }),
    );
    mockUseAuth.mockReturnValue({ setSession } as any);

    render(<RegisterView />);

    expect(screen.getByLabelText('Verification code')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Create Account'));

    await waitFor(() => {
      expect(handleVerifyOtp).toHaveBeenCalledTimes(1);
      expect(setSession).toHaveBeenCalledWith(
        'access-token',
        'refresh-token',
        session.user,
      );
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
    });
  });

  it('edits OTP and returns to the details step', () => {
    const updateField = jest.fn();
    const goBack = jest.fn();
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({
        step: 'otp',
        updateField,
        goBack,
        apiError: 'The OTP is invalid or has expired.',
        errors: {
          otp: 'Use the latest verification code.',
        },
      }),
    );

    render(<RegisterView />);

    expect(screen.getByText('The OTP is invalid or has expired.')).toBeTruthy();
    expect(screen.getByText('Use the latest verification code.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Verification code'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByLabelText('Go back to account details'));

    expect(updateField).toHaveBeenCalledWith('otp', '654321');
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('routes to sign in from details without submitting registration', () => {
    const handleSubmitDetails = jest.fn().mockResolvedValue(undefined);
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({ handleSubmitDetails }),
    );

    render(<RegisterView />);

    fireEvent.click(screen.getByLabelText('Sign in'));

    expect(router.push).toHaveBeenCalledWith('/');
    expect(handleSubmitDetails).not.toHaveBeenCalled();
  });

  it('does not navigate when OTP verification returns no session', async () => {
    const handleVerifyOtp = jest.fn().mockResolvedValue(null);
    const setSession = jest.fn().mockResolvedValue(undefined);
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({
        step: 'otp',
        handleVerifyOtp,
      }),
    );
    mockUseAuth.mockReturnValue({ setSession } as any);

    render(<RegisterView />);

    fireEvent.click(screen.getByLabelText('Create Account'));

    await waitFor(() => {
      expect(handleVerifyOtp).toHaveBeenCalledTimes(1);
    });
    expect(setSession).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('disables details controls while registration is loading', () => {
    const handleSubmitDetails = jest.fn().mockResolvedValue(undefined);
    mockUseRegisterViewModel.mockReturnValue(
      buildViewModel({
        handleSubmitDetails,
        isLoading: true,
      }),
    );

    render(<RegisterView />);

    expect((screen.getByLabelText('Email') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Username') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Password') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByLabelText('Phone number') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByLabelText('Birth date') as HTMLInputElement).disabled,
    ).toBe(true);
    expect(screen.getByRole('progressbar')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Continue in progress'));
    fireEvent.click(screen.getByLabelText('Sign in'));

    expect(handleSubmitDetails).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
