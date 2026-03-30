import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForgotPasswordViewModel } from '@/viewmodels/auth/useForgotPasswordViewModel';
import '@/styles/auth.css';

export default function ForgotPasswordView() {
  const vm = useForgotPasswordViewModel();
  const navigate = useNavigate();

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await vm.handleRequestOtp();
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await vm.handleVerifyOtp();
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await vm.handleResetPassword();
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        {vm.step === 'request' && (
          <>
            <h1 className="auth-title">Forgot Password</h1>
            <p className="auth-subtitle">
              Enter your email address and we&apos;ll send you a code to reset your password.
            </p>

            {vm.apiError && <div className="error-banner">{vm.apiError}</div>}

            <form onSubmit={handleRequestSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="email">
                  Email Address
                </label>
                <input
                  id="email"
                  className={`field-input ${vm.errors.email ? 'has-error' : ''}`}
                  type="email"
                  placeholder="name@example.com"
                  value={vm.email}
                  onChange={(e) => vm.setEmail(e.target.value)}
                  disabled={vm.isLoading}
                />
                {vm.errors.email && (
                  <p className="field-error">{vm.errors.email}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={vm.isLoading}
              >
                {vm.isLoading ? <span className="spinner" /> : 'Send Code'}
              </button>
            </form>
          </>
        )}

        {vm.step === 'verify' && (
          <>
            <h1 className="auth-title">Verify Email</h1>
            <p className="auth-subtitle">
              Enter the 6-digit code sent to <strong>{vm.email}</strong>
            </p>

            {vm.apiError && <div className="error-banner">{vm.apiError}</div>}

            <form onSubmit={handleVerifySubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="otp">
                  Verification Code
                </label>
                <input
                  id="otp"
                  className={`field-input ${vm.errors.otp ? 'has-error' : ''}`}
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={vm.otp}
                  onChange={(e) => vm.setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={vm.isLoading}
                />
                {vm.errors.otp && (
                  <p className="field-error">{vm.errors.otp}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={vm.isLoading}
              >
                {vm.isLoading ? <span className="spinner" /> : 'Verify Code'}
              </button>
            </form>
          </>
        )}

        {vm.step === 'reset' && (
          <>
            <h1 className="auth-title">Create New Password</h1>
            <p className="auth-subtitle">
              Your new password must be at least 8 characters long.
            </p>

            {vm.apiError && <div className="error-banner">{vm.apiError}</div>}

            <form onSubmit={handleResetSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="newPassword">
                  New Password
                </label>
                <input
                  id="newPassword"
                  className={`field-input ${vm.errors.newPassword ? 'has-error' : ''}`}
                  type="password"
                  placeholder="New password"
                  value={vm.newPassword}
                  onChange={(e) => vm.setNewPassword(e.target.value)}
                  disabled={vm.isLoading}
                />
                {vm.errors.newPassword && (
                  <p className="field-error">{vm.errors.newPassword}</p>
                )}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  className={`field-input ${vm.errors.confirmPassword ? 'has-error' : ''}`}
                  type="password"
                  placeholder="Confirm password"
                  value={vm.confirmPassword}
                  onChange={(e) => vm.setConfirmPassword(e.target.value)}
                  disabled={vm.isLoading}
                />
                {vm.errors.confirmPassword && (
                  <p className="field-error">{vm.errors.confirmPassword}</p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={vm.isLoading}
              >
                {vm.isLoading ? <span className="spinner" /> : 'Set Password'}
              </button>
            </form>
          </>
        )}

        {vm.step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <h1 className="auth-title">Password Reset</h1>
            <p className="auth-subtitle">
              Your password has been changed successfully. You can now log in with your new password.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/login')}
              style={{ marginTop: '1rem' }}
            >
              Go to Login
            </button>
          </div>
        )}

        {vm.step !== 'success' && (
          <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
            <a onClick={() => navigate('/login')} className="link">
              Back to Login
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
