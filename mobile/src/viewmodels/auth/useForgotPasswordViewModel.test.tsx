/**
 * @jest-environment jsdom
 */
import { renderHook, act, type RenderHookResult } from '@testing-library/react';
import * as authService from '@/services/authService';
import { ApiError } from '@/services/api';
import {
  useForgotPasswordViewModel,
  type ForgotPasswordViewModel,
} from './useForgotPasswordViewModel';

jest.mock('@/services/authService');

const mockRequestPasswordResetOtp = jest.mocked(
  authService.requestPasswordResetOtp,
);
const mockVerifyPasswordResetOtp = jest.mocked(
  authService.verifyPasswordResetOtp,
);
const mockResetPassword = jest.mocked(authService.resetPassword);

const genericOtpSuccess = {
  status: 'ok' as const,
  message:
    'If an account with that email exists, a password-reset OTP has been sent.',
};

const verifySuccess = {
  status: 'ok' as const,
  reset_token: 'test-reset-token-abc123',
  expires_in_seconds: 600,
};

const resetSuccess = {
  status: 'ok' as const,
  message: 'Password has been reset.',
};

type HookResult = RenderHookResult<ForgotPasswordViewModel, unknown>;

async function advanceToOtpStep(hook: HookResult) {
  await act(async () => {
    hook.result.current.updateField('email', 'user@example.com');
  });
  await act(async () => {
    await hook.result.current.handleRequestOtp();
  });
}

async function advanceToResetStep(hook: HookResult) {
  await advanceToOtpStep(hook);
  await act(async () => {
    hook.result.current.updateField('otp', '123456');
  });
  await act(async () => {
    await hook.result.current.handleVerifyOtp();
  });
}

describe('useForgotPasswordViewModel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestPasswordResetOtp.mockResolvedValue(genericOtpSuccess);
    mockVerifyPasswordResetOtp.mockResolvedValue(verifySuccess);
    mockResetPassword.mockResolvedValue(resetSuccess);
  });

  // --- Step 1: Email / Request OTP ---

  it('starts on the email step with empty form', () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    expect(hook.result.current.step).toBe('email');
    expect(hook.result.current.formData.email).toBe('');
    expect(hook.result.current.isLoading).toBe(false);
    expect(hook.result.current.apiError).toBeNull();
    expect(hook.result.current.successMessage).toBeNull();
  });

  it('does not call API when email validation fails', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());

    await act(async () => {
      await hook.result.current.handleRequestOtp();
    });

    expect(mockRequestPasswordResetOtp).not.toHaveBeenCalled();
    expect(hook.result.current.errors.email).toBeTruthy();
    expect(hook.result.current.step).toBe('email');
  });

  it('advances to otp step after successful OTP request', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToOtpStep(hook);

    expect(mockRequestPasswordResetOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
    expect(hook.result.current.step).toBe('otp');
    expect(hook.result.current.apiError).toBeNull();
  });

  it('trims email before sending', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());

    await act(async () => {
      hook.result.current.updateField('email', '  user@example.com  ');
    });
    await act(async () => {
      await hook.result.current.handleRequestOtp();
    });

    expect(mockRequestPasswordResetOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
    });
  });

  it('shows apiError on OTP request failure', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());

    mockRequestPasswordResetOtp.mockRejectedValueOnce(
      new ApiError(500, {
        error: {
          code: 'internal_server_error',
          message: 'An unexpected error occurred.',
        },
      }),
    );

    await act(async () => {
      hook.result.current.updateField('email', 'user@example.com');
    });
    await act(async () => {
      await hook.result.current.handleRequestOtp();
    });

    expect(hook.result.current.apiError).toBe('An unexpected error occurred.');
    expect(hook.result.current.step).toBe('email');
  });

  it('handles unexpected error on OTP request', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());

    mockRequestPasswordResetOtp.mockRejectedValueOnce(new Error('Network'));

    await act(async () => {
      hook.result.current.updateField('email', 'user@example.com');
    });
    await act(async () => {
      await hook.result.current.handleRequestOtp();
    });

    expect(hook.result.current.apiError).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  it('clears field error when email is updated', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());

    await act(async () => {
      await hook.result.current.handleRequestOtp();
    });
    expect(hook.result.current.errors.email).toBeTruthy();

    await act(async () => {
      hook.result.current.updateField('email', 'a@b.co');
    });
    expect(hook.result.current.errors.email).toBeNull();
    expect(hook.result.current.apiError).toBeNull();
  });

  // --- Step 2: OTP Verification ---

  it('does not call verify API when OTP validation fails', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToOtpStep(hook);

    await act(async () => {
      await hook.result.current.handleVerifyOtp();
    });

    expect(mockVerifyPasswordResetOtp).not.toHaveBeenCalled();
    expect(hook.result.current.errors.otp).toBeTruthy();
    expect(hook.result.current.step).toBe('otp');
  });

  it('advances to reset step after successful OTP verification', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToResetStep(hook);

    expect(mockVerifyPasswordResetOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      otp: '123456',
    });
    expect(hook.result.current.step).toBe('reset');
    expect(hook.result.current.apiError).toBeNull();
  });

  it('shows OTP field error on invalid_otp and clears the input', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToOtpStep(hook);

    mockVerifyPasswordResetOtp.mockRejectedValueOnce(
      new ApiError(401, {
        error: {
          code: 'invalid_otp',
          message: 'The OTP is invalid or has expired.',
        },
      }),
    );

    await act(async () => {
      hook.result.current.updateField('otp', '999999');
    });
    await act(async () => {
      await hook.result.current.handleVerifyOtp();
    });

    expect(hook.result.current.errors.otp).toBe(
      'The OTP is invalid or has expired.',
    );
    expect(hook.result.current.formData.otp).toBe('');
    expect(hook.result.current.step).toBe('otp');
  });

  it('shows apiError on OTP verify server error', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToOtpStep(hook);

    mockVerifyPasswordResetOtp.mockRejectedValueOnce(
      new ApiError(500, {
        error: {
          code: 'internal_server_error',
          message: 'An unexpected error occurred.',
        },
      }),
    );

    await act(async () => {
      hook.result.current.updateField('otp', '123456');
    });
    await act(async () => {
      await hook.result.current.handleVerifyOtp();
    });

    expect(hook.result.current.apiError).toBe('An unexpected error occurred.');
    expect(hook.result.current.step).toBe('otp');
  });

  // --- Step 3: Reset Password ---

  it('does not call reset API when password validation fails', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToResetStep(hook);

    await act(async () => {
      hook.result.current.updateField('newPassword', 'short');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await hook.result.current.handleResetPassword();
    });

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(hook.result.current.errors.newPassword).toBeTruthy();
    expect(success).toBe(false);
  });

  it('calls reset API and returns true on success', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToResetStep(hook);

    await act(async () => {
      hook.result.current.updateField('newPassword', 'StrongPassword123');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await hook.result.current.handleResetPassword();
    });

    expect(mockResetPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      reset_token: 'test-reset-token-abc123',
      new_password: 'StrongPassword123',
    });
    expect(success).toBe(true);
    expect(hook.result.current.successMessage).toBe('Password has been reset.');
  });

  it('shows apiError on invalid reset token', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToResetStep(hook);

    mockResetPassword.mockRejectedValueOnce(
      new ApiError(401, {
        error: {
          code: 'invalid_password_reset_token',
          message: 'The password reset session is invalid or has expired.',
        },
      }),
    );

    await act(async () => {
      hook.result.current.updateField('newPassword', 'StrongPassword123');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await hook.result.current.handleResetPassword();
    });

    expect(success).toBe(false);
    expect(hook.result.current.apiError).toBe(
      'The password reset session is invalid or has expired.',
    );
  });

  it('handles unexpected error on reset', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToResetStep(hook);

    mockResetPassword.mockRejectedValueOnce(new Error('Network'));

    await act(async () => {
      hook.result.current.updateField('newPassword', 'StrongPassword123');
    });

    let success: boolean | undefined;
    await act(async () => {
      success = await hook.result.current.handleResetPassword();
    });

    expect(success).toBe(false);
    expect(hook.result.current.apiError).toBe(
      'An unexpected error occurred. Please try again.',
    );
  });

  // --- Navigation: goBack ---

  it('goes back from otp to email step', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToOtpStep(hook);
    expect(hook.result.current.step).toBe('otp');

    await act(async () => {
      hook.result.current.goBack();
    });

    expect(hook.result.current.step).toBe('email');
    expect(hook.result.current.formData.otp).toBe('');
    expect(hook.result.current.apiError).toBeNull();
  });

  it('goes back from reset to otp step', async () => {
    const hook = renderHook(() => useForgotPasswordViewModel());
    await advanceToResetStep(hook);
    expect(hook.result.current.step).toBe('reset');

    await act(async () => {
      hook.result.current.goBack();
    });

    expect(hook.result.current.step).toBe('otp');
    expect(hook.result.current.formData.newPassword).toBe('');
  });
});
