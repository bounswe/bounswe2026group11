import { useNavigate } from 'react-router-dom';
import '@/styles/auth.css';

export default function AuthPage() {
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-card auth-landing">
        <h1 className="auth-title">Social Event Mapper</h1>
        <p className="auth-subtitle">
          Discover and join events happening around you
        </p>

        <div className="btn-group">
          <button
            className="btn-primary"
            onClick={() => navigate('/login')}
          >
            Sign In
          </button>
          <button
            className="btn-outline"
            onClick={() => navigate('/register')}
          >
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
}
