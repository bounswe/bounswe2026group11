import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trans, useTranslation } from 'react-i18next';
import { useForgotPasswordViewModel } from '@/viewmodels/auth/useForgotPasswordViewModel';
import '@/styles/auth.css';

export default function ForgotPasswordView() {
  const { t } = useTranslation();
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
            <h1 className="auth-title">{t('auth.forgot_password.request_title')}</h1>
            <p className="auth-subtitle">{t('auth.forgot_password.request_subtitle')}</p>

            {vm.apiError && (
              <div className="error-banner" role="alert" aria-live="assertive">
                {vm.apiError}
              </div>
            )}

            <form onSubmit={handleRequestSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="email">
                  {t('auth.forgot_password.email')}
                </label>
                <input
                  id="email"
                  className={`field-input ${vm.errors.email ? 'has-error' : ''}`}
                  type="email"
                  placeholder={t('auth.forgot_password.email_placeholder')}
                  value={vm.email}
                  onChange={(e) => vm.setEmail(e.target.value)}
                  disabled={vm.isLoading}
                  autoComplete="email"
                  aria-invalid={!!vm.errors.email}
                  aria-describedby={vm.errors.email ? 'forgot-email-error' : undefined}
                />
                {vm.errors.email && (
                  <p className="field-error" id="forgot-email-error" role="alert">
                    {vm.errors.email}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={vm.isLoading}
              >
                {vm.isLoading ? <span className="spinner" /> : t('auth.forgot_password.send_code')}
              </button>
            </form>
          </>
        )}

        {vm.step === 'verify' && (
          <>
            <h1 className="auth-title">{t('auth.forgot_password.verify_title')}</h1>
            <p className="auth-subtitle">
              <Trans
                i18nKey="auth.forgot_password.verify_subtitle"
                values={{ email: vm.email }}
                components={{ strong: <strong /> }}
              />
            </p>

            {vm.apiError && (
              <div className="error-banner" role="alert" aria-live="assertive">
                {vm.apiError}
              </div>
            )}

            <form onSubmit={handleVerifySubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="otp">
                  {t('auth.forgot_password.verification_code')}
                </label>
                <input
                  id="otp"
                  className={`field-input ${vm.errors.otp ? 'has-error' : ''}`}
                  type="text"
                  placeholder={t('auth.forgot_password.verification_code_placeholder')}
                  maxLength={6}
                  value={vm.otp}
                  onChange={(e) => vm.setOtp(e.target.value.replace(/\D/g, ''))}
                  disabled={vm.isLoading}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  aria-invalid={!!vm.errors.otp}
                  aria-describedby={vm.errors.otp ? 'forgot-otp-error' : undefined}
                />
                {vm.errors.otp && (
                  <p className="field-error" id="forgot-otp-error" role="alert">
                    {vm.errors.otp}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={vm.isLoading}
              >
                {vm.isLoading ? <span className="spinner" /> : t('auth.forgot_password.verify_code')}
              </button>
            </form>
          </>
        )}

        {vm.step === 'reset' && (
          <>
            <h1 className="auth-title">{t('auth.forgot_password.reset_title')}</h1>
            <p className="auth-subtitle">{t('auth.forgot_password.reset_subtitle')}</p>

            {vm.apiError && (
              <div className="error-banner" role="alert" aria-live="assertive">
                {vm.apiError}
              </div>
            )}

            <form onSubmit={handleResetSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="newPassword">
                  {t('auth.forgot_password.new_password')}
                </label>
                <input
                  id="newPassword"
                  className={`field-input ${vm.errors.newPassword ? 'has-error' : ''}`}
                  type="password"
                  placeholder={t('auth.forgot_password.new_password_placeholder')}
                  value={vm.newPassword}
                  onChange={(e) => vm.setNewPassword(e.target.value)}
                  disabled={vm.isLoading}
                  autoComplete="new-password"
                  aria-invalid={!!vm.errors.newPassword}
                  aria-describedby={vm.errors.newPassword ? 'new-password-error' : undefined}
                />
                {vm.errors.newPassword && (
                  <p className="field-error" id="new-password-error" role="alert">
                    {vm.errors.newPassword}
                  </p>
                )}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="confirmPassword">
                  {t('auth.forgot_password.confirm_password')}
                </label>
                <input
                  id="confirmPassword"
                  className={`field-input ${vm.errors.confirmPassword ? 'has-error' : ''}`}
                  type="password"
                  placeholder={t('auth.forgot_password.confirm_password_placeholder')}
                  value={vm.confirmPassword}
                  onChange={(e) => vm.setConfirmPassword(e.target.value)}
                  disabled={vm.isLoading}
                  autoComplete="new-password"
                  aria-invalid={!!vm.errors.confirmPassword}
                  aria-describedby={vm.errors.confirmPassword ? 'confirm-password-error' : undefined}
                />
                {vm.errors.confirmPassword && (
                  <p className="field-error" id="confirm-password-error" role="alert">
                    {vm.errors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={vm.isLoading}
              >
                {vm.isLoading ? <span className="spinner" /> : t('auth.forgot_password.set_password')}
              </button>
            </form>
          </>
        )}

        {vm.step === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <h1 className="auth-title">{t('auth.forgot_password.success_title')}</h1>
            <p className="auth-subtitle">{t('auth.forgot_password.success_subtitle')}</p>
            <button
              className="btn-primary"
              onClick={() => navigate('/login')}
              style={{ marginTop: '1rem' }}
            >
              {t('auth.forgot_password.go_to_login')}
            </button>
          </div>
        )}

        {vm.step !== 'success' && (
          <div className="auth-footer" style={{ marginTop: '1.5rem' }}>
            <Link to="/login" className="link">
              {t('auth.forgot_password.back_to_login')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
