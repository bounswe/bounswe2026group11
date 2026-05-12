/**
 * @jest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import LoginView from './LoginView';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLoginViewModel,
  type LoginViewModel,
} from '@/viewmodels/auth/useLoginViewModel';
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

jest.mock('@/viewmodels/auth/useLoginViewModel', () => ({
  useLoginViewModel: jest.fn(),
}));

const mockUseAuth = jest.mocked(useAuth);
const mockUseLoginViewModel = jest.mocked(useLoginViewModel);

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

function buildViewModel(overrides: Partial<LoginViewModel> = {}): LoginViewModel {
  return {
    formData: {
      username: '',
      password: '',
    },
    errors: {},
    isLoading: false,
    apiError: null,
    updateField: jest.fn(),
    handleLogin: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('LoginView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      setSession: jest.fn().mockResolvedValue(undefined),
    } as any);
    mockUseLoginViewModel.mockReturnValue(buildViewModel());
  });

  it('renders validation feedback and lets users edit credentials', () => {
    const updateField = jest.fn();
    mockUseLoginViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        apiError: 'Invalid credentials.',
        errors: {
          username: 'Username is required.',
          password: 'Password is required.',
        },
      }),
    );

    render(<LoginView />);

    expect(screen.getByTestId('SemLogo')).toBeTruthy();
    expect(screen.getByText('Welcome Back')).toBeTruthy();
    expect(screen.getByText('Invalid credentials.')).toBeTruthy();
    expect(screen.getByText('Username is required.')).toBeTruthy();
    expect(screen.getByText('Password is required.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Username'), {
      target: { value: 'maplover' },
    });
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret123' },
    });

    expect(updateField).toHaveBeenNthCalledWith(1, 'username', 'maplover');
    expect(updateField).toHaveBeenNthCalledWith(2, 'password', 'secret123');
  });

  it('stores the returned session and navigates home after sign in', async () => {
    const handleLogin = jest.fn().mockResolvedValue(session);
    const setSession = jest.fn().mockResolvedValue(undefined);
    mockUseLoginViewModel.mockReturnValue(buildViewModel({ handleLogin }));
    mockUseAuth.mockReturnValue({ setSession } as any);

    render(<LoginView />);

    fireEvent.click(screen.getByLabelText('Sign in'));

    await waitFor(() => {
      expect(handleLogin).toHaveBeenCalledTimes(1);
      expect(setSession).toHaveBeenCalledWith(
        'access-token',
        'refresh-token',
        session.user,
      );
      expect(router.replace).toHaveBeenCalledWith('/(tabs)/home');
    });
  });

  it('routes secondary auth actions without submitting', () => {
    const handleLogin = jest.fn().mockResolvedValue(null);
    mockUseLoginViewModel.mockReturnValue(buildViewModel({ handleLogin }));

    render(<LoginView />);

    fireEvent.click(screen.getByLabelText('Forgot password'));
    fireEvent.click(screen.getByLabelText('Sign up'));

    expect(router.push).toHaveBeenNthCalledWith(1, '/forgot-password');
    expect(router.push).toHaveBeenNthCalledWith(2, '/register');
    expect(handleLogin).not.toHaveBeenCalled();
  });

  it('disables inputs and links while signing in', () => {
    const handleLogin = jest.fn().mockResolvedValue(null);
    mockUseLoginViewModel.mockReturnValue(
      buildViewModel({
        handleLogin,
        isLoading: true,
      }),
    );

    render(<LoginView />);

    expect((screen.getByLabelText('Username') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect((screen.getByLabelText('Password') as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole('progressbar')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Signing in'));
    fireEvent.click(screen.getByLabelText('Forgot password'));

    expect(handleLogin).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();
  });
});
