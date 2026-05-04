/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import * as profileService from '@/services/profileService';
import { ApiError } from '@/services/api';
import { useChangePasswordViewModel } from './useChangePasswordViewModel';
import { useAuth } from '@/contexts/AuthContext';

jest.mock('@/services/profileService');
jest.mock('@/contexts/AuthContext');

const mockChangePassword = jest.mocked(profileService.changePassword);
const mockUseAuth = jest.mocked(useAuth);

describe('useChangePasswordViewModel', () => {
  const mockToken = 'test-token';

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: mockToken,
      refreshToken: 'refresh',
      user: {} as any,
      isHydrating: false,
      setSession: jest.fn(),
      clearAuth: jest.fn(),
    });
  });

  it('starts with empty form and no errors', () => {
    const { result } = renderHook(() => useChangePasswordViewModel());
    expect(result.current.formData.currentPassword).toBe('');
    expect(result.current.formData.newPassword).toBe('');
    expect(result.current.formData.confirmPassword).toBe('');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.apiError).toBeNull();
    expect(result.current.successMessage).toBeNull();
  });

  it('validates required fields', async () => {
    const { result } = renderHook(() => useChangePasswordViewModel());

    await act(async () => {
      const success = await result.current.handleSubmit();
      expect(success).toBe(false);
    });

    expect(result.current.errors.currentPassword).toBe('Current password is required.');
    expect(result.current.errors.newPassword).toBeTruthy();
    expect(result.current.errors.confirmPassword).toBe('Please confirm your new password.');
  });

  it('validates password match', async () => {
    const { result } = renderHook(() => useChangePasswordViewModel());

    await act(async () => {
      result.current.updateField('currentPassword', 'OldPass123!');
      result.current.updateField('newPassword', 'NewPass123!');
      result.current.updateField('confirmPassword', 'WrongPass123!');
    });

    await act(async () => {
      const success = await result.current.handleSubmit();
      expect(success).toBe(false);
    });

    expect(result.current.errors.confirmPassword).toBe('Passwords do not match.');
  });

  it('validates new password is different from current', async () => {
    const { result } = renderHook(() => useChangePasswordViewModel());

    await act(async () => {
      result.current.updateField('currentPassword', 'SamePass123!');
      result.current.updateField('newPassword', 'SamePass123!');
      result.current.updateField('confirmPassword', 'SamePass123!');
    });

    await act(async () => {
      const success = await result.current.handleSubmit();
      expect(success).toBe(false);
    });

    expect(result.current.errors.newPassword).toBe('New password must be different from current password.');
  });

  it('handles successful password change', async () => {
    mockChangePassword.mockResolvedValueOnce();
    const { result } = renderHook(() => useChangePasswordViewModel());

    await act(async () => {
      result.current.updateField('currentPassword', 'OldPass123!');
      result.current.updateField('newPassword', 'NewPass123!');
      result.current.updateField('confirmPassword', 'NewPass123!');
    });

    let success = false;
    await act(async () => {
      success = await result.current.handleSubmit();
    });

    expect(success).toBe(true);
    expect(mockChangePassword).toHaveBeenCalledWith('OldPass123!', 'NewPass123!', mockToken);
    expect(result.current.successMessage).toBe('Password changed successfully.');
    expect(result.current.formData.currentPassword).toBe('');
  });

  it('handles wrong current password (401)', async () => {
    mockChangePassword.mockRejectedValueOnce(new ApiError(401, { error: { code: 'unauthorized', message: 'Unauthorized' } }));
    const { result } = renderHook(() => useChangePasswordViewModel());

    await act(async () => {
      result.current.updateField('currentPassword', 'WrongOld123!');
      result.current.updateField('newPassword', 'NewPass123!');
      result.current.updateField('confirmPassword', 'NewPass123!');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.currentPassword).toBe('Current password is incorrect.');
  });

  it('handles generic API errors', async () => {
    mockChangePassword.mockRejectedValueOnce(new ApiError(400, { error: { code: 'validation_error', message: 'Some validation error' } }));
    const { result } = renderHook(() => useChangePasswordViewModel());

    await act(async () => {
      result.current.updateField('currentPassword', 'OldPass123!');
      result.current.updateField('newPassword', 'NewPass123!');
      result.current.updateField('confirmPassword', 'NewPass123!');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.apiError).toBe('Some validation error');
  });
});
