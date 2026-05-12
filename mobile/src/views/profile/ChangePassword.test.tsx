/**
 * @jest-environment jsdom
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { router } from 'expo-router';
import ChangePasswordView from './ChangePasswordView';
import {
  useChangePasswordViewModel,
  type ChangePasswordViewModel,
} from '@/viewmodels/profile/useChangePasswordViewModel';

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
    MaterialIcons: ({ name }: { name: string }) =>
      ReactLocal.createElement('span', { 'data-icon': name }),
  };
});

jest.mock('@/viewmodels/profile/useChangePasswordViewModel', () => ({
  useChangePasswordViewModel: jest.fn(),
}));

const mockUseChangePasswordViewModel = jest.mocked(useChangePasswordViewModel);

function buildViewModel(
  overrides: Partial<ChangePasswordViewModel> = {},
): ChangePasswordViewModel {
  return {
    formData: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    errors: {},
    isLoading: false,
    apiError: null,
    successMessage: null,
    updateField: jest.fn(),
    handleSubmit: jest.fn().mockResolvedValue(false),
    ...overrides,
  };
}

describe('ChangePasswordView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChangePasswordViewModel.mockReturnValue(buildViewModel());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders password fields, validation feedback, and visibility toggles', () => {
    const updateField = jest.fn();
    mockUseChangePasswordViewModel.mockReturnValue(
      buildViewModel({
        updateField,
        formData: {
          currentPassword: 'old-password',
          newPassword: 'new-password',
          confirmPassword: '',
        },
        errors: {
          confirmPassword: 'Passwords do not match.',
        },
      }),
    );

    const { container } = render(<ChangePasswordView />);

    expect(screen.getAllByText('Change Password').length).toBeGreaterThan(0);
    expect(screen.getByText('Must be at least 8 characters long.')).toBeTruthy();
    expect(screen.getByText('Passwords do not match.')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'updated-current' },
    });
    fireEvent.change(screen.getByLabelText('New Password'), {
      target: { value: 'updated-new' },
    });

    expect(updateField).toHaveBeenNthCalledWith(1, 'currentPassword', 'updated-current');
    expect(updateField).toHaveBeenNthCalledWith(2, 'newPassword', 'updated-new');
    expect(container.querySelectorAll('[data-icon="eye-outline"]').length).toBe(3);

    fireEvent.click(screen.getByLabelText('Show Current Password'));

    expect(container.querySelectorAll('[data-icon="eye-off-outline"]').length).toBe(1);

    fireEvent.click(screen.getByLabelText('Hide Current Password'));

    expect(container.querySelectorAll('[data-icon="eye-off-outline"]').length).toBe(0);
  });

  it('submits through the view model and returns after a successful change', async () => {
    jest.useFakeTimers();
    const handleSubmit = jest.fn().mockResolvedValue(true);
    mockUseChangePasswordViewModel.mockReturnValue(buildViewModel({ handleSubmit }));

    render(<ChangePasswordView />);

    fireEvent.click(screen.getByLabelText('Change password'));

    await waitFor(() => expect(handleSubmit).toHaveBeenCalledTimes(1));

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(router.back).toHaveBeenCalledTimes(1);
  });

  it('disables submission while loading and surfaces banner messages', () => {
    const handleSubmit = jest.fn().mockResolvedValue(false);
    mockUseChangePasswordViewModel.mockReturnValue(
      buildViewModel({
        handleSubmit,
        isLoading: true,
        apiError: 'Current password is incorrect.',
        successMessage: 'Password changed successfully.',
      }),
    );

    render(<ChangePasswordView />);

    expect(screen.getByText('Current password is incorrect.')).toBeTruthy();
    expect(screen.getByText('Password changed successfully.')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Change password'));

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
