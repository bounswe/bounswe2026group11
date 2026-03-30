import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLoginViewModel } from '@/viewmodels/auth/useLoginViewModel';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/auth.css';

export default function LoginView() {
  const vm = useLoginViewModel();
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const session = await vm.handleLogin();
    if (session) {
      setSession(session.access_token, session.refresh_token, session.user.username);
      navigate('/discover', { replace: true });
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to continue to your account</p>

        {vm.apiError && (
          <div className="error-banner">{vm.apiError}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="username">
              Username
            </label>
            <input
              id="username"
              className={`field-input ${vm.errors.username ? 'has-error' : ''}`}
              type="text"
              placeholder="maplover"
              value={vm.formData.username}
              onChange={(e) => vm.updateField('username', e.target.value)}
              autoComplete="username"
              disabled={vm.isLoading}
            />
            {vm.errors.username && (
              <p className="field-error">{vm.errors.username}</p>
            )}
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={`field-input ${vm.errors.password ? 'has-error' : ''}`}
              type="password"
              placeholder="Your password"
              value={vm.formData.password}
              onChange={(e) => vm.updateField('password', e.target.value)}
              autoComplete="current-password"
              disabled={vm.isLoading}
            />
            {vm.errors.password && (
              <p className="field-error">{vm.errors.password}</p>
            )}
            <div style={{ textAlign: 'right', marginTop: '0.5rem', marginBottom: '1rem' }}>
              <a onClick={() => navigate('/forgot-password')} className="link" style={{ fontSize: '0.875rem' }}>
                Forgot Password?
              </a>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={vm.isLoading}
          >
            {vm.isLoading ? <span className="spinner" /> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <span>Don&apos;t have an account?</span>
          <a onClick={() => navigate('/register')} className="link">
            Sign Up
          </a>
        </div>
      </div>
    </div>
  );
}
