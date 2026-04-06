import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/UserAvatar';
import { logout } from '@/services/authService';
import '@/styles/shell.css';

const PUBLIC_NAV = [
  { to: '/discover', label: 'Discover' },
];

const AUTH_NAV = [
  { to: '/discover', label: 'Discover' },
  { to: '/my-events', label: 'My Events' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/profile', label: 'Profile' },
];

export default function AppShell() {
  const { token, username, avatarUrl, displayName, refreshToken, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!token;
  const navItems = isLoggedIn ? AUTH_NAV : PUBLIC_NAV;

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
            Social Event Mapper
          </NavLink>

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

          <div className="shell-header-right">
            {isLoggedIn ? (
              <>
                <NavLink to="/events/create" className="shell-create-btn">
                  + Create Event
                </NavLink>
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

            <button
              className="shell-hamburger"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation"
            >
              <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <div className="shell-overlay" onClick={closeMobileMenu} />}

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
