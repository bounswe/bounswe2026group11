import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import '@/styles/auth.css';

export default function AuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-card auth-landing">
        <h1 className="auth-title">{t('auth.entry.title')}</h1>
        <p className="auth-subtitle">{t('auth.entry.subtitle')}</p>

        <div className="btn-group">
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/login')}
          >
            {t('auth.login.submit')}
          </button>
          <button
            type="button"
            className="btn-outline"
            onClick={() => navigate('/register')}
          >
            {t('auth.register.title')}
          </button>
        </div>
      </div>
    </div>
  );
}
