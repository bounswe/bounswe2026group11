import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/UserAvatar';
import { logout } from '@/services/authService';
import SemLogo from '@/components/SemLogo';
import '@/styles/shell.css';

const AUTH_NAV = [
  { to: '/discover', label: 'Discover' },
  { to: '/my-events', label: 'My Events' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/profile', label: 'Profile' },
];

export default function AppShell() {
  const { token, username, role, avatarUrl, displayName, refreshToken, clearAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!token;
  const navItems = isLoggedIn ? AUTH_NAV : [];
  const isAdminPanel = location.pathname.startsWith('/admin-panel');

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    if (refreshToken) {
      try {
        await logout({ refresh_token: refreshToken });
      } catch {
        // Proceed with local logout even if the API call fails
      }
    }
    clearAuth();
    navigate('/discover', { replace: true });
  };

  const closeMobileMenu = () => setMenuOpen(false);

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="shell-header-inner">
          <NavLink to="/discover" className="shell-logo" onClick={closeMobileMenu}>
            <SemLogo height={48} color="#111827" />
          </NavLink>

          {navItems.length > 0 && (
            <nav className={`shell-nav ${menuOpen ? 'open' : ''}`}>
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `shell-nav-link ${isActive ? 'active' : ''}`
                  }
                  onClick={closeMobileMenu}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}

          <div className="shell-header-right">
            {isLoggedIn ? (
              <>
                <NavLink to="/events/create" className="shell-create-btn">
                  + Create Event
                </NavLink>
                {role === 'ADMIN' && (
                  <NavLink to="/admin-panel" className="shell-admin-btn">
                    <svg className="shell-admin-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3.5 18 6v5.2c0 3.9-2.4 7.4-6 8.8-3.6-1.4-6-4.9-6-8.8V6l6-2.5Z" />
                    </svg>
                    <span>Admin Panel</span>
                  </NavLink>
                )}
                <div className="shell-user-menu" ref={userMenuRef}>
                  <button
                    className="shell-user-btn"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                  >
                    <span className="shell-avatar">
                      <UserAvatar
                        username={username ?? '?'}
                        displayName={displayName}
                        avatarUrl={avatarUrl}
                        size="sm"
                        variant="accent"
                      />
                    </span>
                    <span className="shell-username">{username}</span>
                  </button>
                  {userMenuOpen && (
                    <div className="shell-dropdown">
                      <NavLink
                        to="/profile"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Profile
                      </NavLink>
                      <button
                        className="shell-dropdown-item shell-dropdown-logout"
                        onClick={handleLogout}
                      >
                        Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="shell-auth-buttons">
                <NavLink to="/login" className="shell-signin-btn">
                  Sign In
                </NavLink>
                <NavLink to="/register" className="shell-signup-btn">
                  Sign Up
                </NavLink>
              </div>
            )}

            {navItems.length > 0 && (
              <button
                className="shell-hamburger"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-label="Toggle navigation"
              >
                <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
                <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
                <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </header>

      {navItems.length > 0 && (
        <div
          className={`shell-overlay ${menuOpen ? 'visible' : ''}`}
          onClick={closeMobileMenu}
        />
      )}

      <main className={`shell-main ${isAdminPanel ? 'admin-panel-main' : ''}`}>
        <Outlet />
      </main>

      {isLoggedIn && (
        <NavLink to="/events/create" className="shell-fab" aria-label="Create Event">
          +
        </NavLink>
      )}
    </div>
  );
}
