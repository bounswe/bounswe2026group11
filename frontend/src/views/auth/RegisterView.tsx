import { useNavigate } from 'react-router-dom';
import {
  useRegisterViewModel,
  type Gender,
  type RegisterStep,
} from '@/viewmodels/auth/useRegisterViewModel';
import { useAuth } from '@/contexts/AuthContext';
import '@/styles/auth.css';

const GENDER_OPTIONS: { label: string; value: Gender }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const STEPS: RegisterStep[] = ['details', 'otp'];

const STEP_SUBTITLES: Record<RegisterStep, string> = {
  details: 'Fill in your details to get started',
  otp: 'Enter the verification code sent to your email',
};

export default function RegisterView() {
  const vm = useRegisterViewModel();
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (vm.step === 'details') {
      await vm.handleSubmitDetails();
    } else {
      const session = await vm.handleVerifyOtp();
      if (session) {
        setSession(session.access_token, session.refresh_token, session.user.username);
        navigate('/discover', { replace: true });
      }
    }
  };

  const buttonLabel = vm.step === 'details' ? 'Continue' : 'Create Account';

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-subtitle">{STEP_SUBTITLES[vm.step]}</p>

        <div className="step-indicator">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`step-dot ${STEPS.indexOf(vm.step) >= i ? 'active' : ''}`}
            />
          ))}
        </div>

        {vm.apiError && (
          <div className="error-banner">{vm.apiError}</div>
        )}

        <form onSubmit={handleSubmit}>
          {vm.step === 'details' && (
            <>
              <div className="field-group">
                <label className="field-label" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  className={`field-input ${vm.errors.email ? 'has-error' : ''}`}
                  type="email"
                  placeholder="user@example.com"
                  value={vm.formData.email}
                  onChange={(e) => vm.updateField('email', e.target.value)}
                  autoComplete="email"
                  disabled={vm.isLoading}
                />
                {vm.errors.email && (
                  <p className="field-error">{vm.errors.email}</p>
                )}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="reg-username">
                  Username
                </label>
                <input
                  id="reg-username"
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
                <label className="field-label" htmlFor="reg-password">
                  Password
                </label>
                <input
                  id="reg-password"
                  className={`field-input ${vm.errors.password ? 'has-error' : ''}`}
                  type="password"
                  placeholder="At least 8 characters"
                  value={vm.formData.password}
                  onChange={(e) => vm.updateField('password', e.target.value)}
                  autoComplete="new-password"
                  disabled={vm.isLoading}
                />
                {vm.errors.password && (
                  <p className="field-error">{vm.errors.password}</p>
                )}
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="phone">
                  Phone Number <span className="optional">(optional)</span>
                </label>
                <input
                  id="phone"
                  className={`field-input ${vm.errors.phone_number ? 'has-error' : ''}`}
                  type="tel"
                  placeholder="+905551112233"
                  value={vm.formData.phone_number}
                  onChange={(e) => vm.updateField('phone_number', e.target.value)}
                  autoComplete="tel"
                  disabled={vm.isLoading}
                />
                {vm.errors.phone_number && (
                  <p className="field-error">{vm.errors.phone_number}</p>
                )}
              </div>

              <div className="field-group">
                <label className="field-label">
                  Gender <span className="optional">(optional)</span>
                </label>
                <div className="gender-row">
                  {GENDER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={`gender-option ${vm.formData.gender === opt.value ? 'selected' : ''}`}
                      onClick={() =>
                        vm.updateField(
                          'gender',
                          vm.formData.gender === opt.value ? '' : opt.value,
                        )
                      }
                      disabled={vm.isLoading}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-group">
                <label className="field-label" htmlFor="birth-date">
                  Birth Date <span className="optional">(optional)</span>
                </label>
                <input
                  id="birth-date"
                  className={`field-input ${vm.errors.birth_date ? 'has-error' : ''}`}
                  type="date"
                  value={vm.formData.birth_date}
                  onChange={(e) => vm.updateField('birth_date', e.target.value)}
                  disabled={vm.isLoading}
                />
                {vm.errors.birth_date && (
                  <p className="field-error">{vm.errors.birth_date}</p>
                )}
              </div>
            </>
          )}

          {vm.step === 'otp' && (
            <div className="field-group">
              <label className="field-label" htmlFor="otp">
                Verification Code
              </label>
              <input
                id="otp"
                className={`field-input ${vm.errors.otp ? 'has-error' : ''}`}
                type="text"
                inputMode="numeric"
                placeholder="123456"
                maxLength={6}
                value={vm.formData.otp}
                onChange={(e) => vm.updateField('otp', e.target.value)}
                disabled={vm.isLoading}
              />
              {vm.errors.otp && (
                <p className="field-error">{vm.errors.otp}</p>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            disabled={vm.isLoading}
          >
            {vm.isLoading ? <span className="spinner" /> : buttonLabel}
          </button>
        </form>

        {vm.step === 'otp' && (
          <button
            type="button"
            className="btn-secondary"
            onClick={vm.goBack}
            disabled={vm.isLoading}
          >
            Go Back
          </button>
        )}

        {vm.step === 'details' && (
          <div className="auth-footer">
            <span>Already have an account?</span>
            <a onClick={() => navigate('/login')} className="link">
              Sign In
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
