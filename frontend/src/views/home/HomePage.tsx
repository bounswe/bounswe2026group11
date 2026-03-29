import { useAuth } from '@/contexts/AuthContext';
import { logout } from '@/services/authService';

export default function HomePage() {
  const { username, refreshToken, clearAuth } = useAuth();

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await logout({ refresh_token: refreshToken });
      } catch {
        // Proceed with local logout even if the API call fails
      }
    }
    clearAuth();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 32, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        Welcome{username ? `, ${username}` : ''}!
      </h1>
      <p style={{ fontSize: 16, color: '#6b7280', marginBottom: 32 }}>
        This page will be replaced with the main app soon.
      </p>
      <button
        onClick={handleLogout}
        style={{
          background: 'none',
          border: '2px solid #dc2626',
          borderRadius: 10,
          padding: '10px 24px',
          color: '#dc2626',
          fontSize: 15,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Sign Out
      </button>
    </div>
  );
}
