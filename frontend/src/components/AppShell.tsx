import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDiscoverViewMode } from '@/contexts/DiscoverViewModeContext';
import { UserAvatar } from '@/components/UserAvatar';
import { logout } from '@/services/authService';
import SemLogo from '@/components/SemLogo';
import { useUnreadCountViewModel } from '@/viewmodels/notifications/useUnreadCountViewModel';
import '@/styles/shell.css';

const AUTH_NAV = [
  { to: '/discover', label: 'Discover' },
  { to: '/my-events', label: 'My Events' },
  { to: '/favorites', label: 'Favorites' },
  { to: '/tickets', label: 'My Tickets' },
  { to: '/invitations', label: 'Invitations' },
];

export default function AppShell() {
  const { token, username, role, avatarUrl, displayName, refreshToken, clearAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!token;
  const navItems = isLoggedIn ? AUTH_NAV : [];
  const isAdminPanel = location.pathname.startsWith('/backoffice') || location.pathname.startsWith('/admin-panel');
  const isDiscoverRoute = location.pathname === '/discover';
  const isDarkMode = theme === 'dark';
  const { unreadCount } = useUnreadCountViewModel();
  const { viewMode, setViewMode } = useDiscoverViewMode();

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
            <SemLogo height={56} color={isDarkMode ? '#f9fafb' : '#111827'} />
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
            {isDiscoverRoute && (
              <div className="shell-view-toggle" role="group" aria-label="Discover view mode">
                <button
                  type="button"
                  className={`shell-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  title="List view"
                >
                  <svg
                    className="shell-view-toggle-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span className="shell-view-toggle-label">List</span>
                </button>
                <button
                  type="button"
                  className={`shell-view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => setViewMode('map')}
                  aria-pressed={viewMode === 'map'}
                  title="Map view"
                >
                  <svg
                    className="shell-view-toggle-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                    <line x1="8" y1="2" x2="8" y2="18" />
                    <line x1="16" y1="6" x2="16" y2="22" />
                  </svg>
                  <span className="shell-view-toggle-label">Map</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className="shell-theme-btn"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="shell-theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2.5M12 19.5V22M4.93 4.93 6.7 6.7M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07 6.7 17.3M17.3 6.7l1.77-1.77" />
                </svg>
              ) : (
                <svg className="shell-theme-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.5 14.4A7.7 7.7 0 0 1 9.6 3.5 8.5 8.5 0 1 0 20.5 14.4Z" />
                </svg>
              )}
            </button>
            {isLoggedIn ? (
              <>
                <NavLink
                  to="/notifications"
                  className="shell-bell-btn"
                  aria-label={
                    unreadCount > 0
                      ? `Notifications, ${unreadCount} unread`
                      : 'Notifications'
                  }
                  title="Notifications"
                >
                  <svg
                    className="shell-bell-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
                    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="shell-bell-badge" aria-hidden>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </NavLink>
                <NavLink
                  to="/events/create"
                  className={({ isActive }) => `shell-create-btn ${isActive ? 'active' : ''}`}
                >
                  + Create Event
                </NavLink>
                {role === 'ADMIN' && (
                  <NavLink to="/backoffice" className="shell-admin-btn">
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
                      <NavLink
                        to="/invitations"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Invitations
                      </NavLink>
                      <NavLink
                        to="/notifications"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Notifications
                      </NavLink>
                      <NavLink
                        to="/tickets"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        My Tickets
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

      <main
        className={`shell-main ${isAdminPanel ? 'admin-panel-main' : ''} ${
          isDiscoverRoute && viewMode === 'map' ? 'discover-map-main' : ''
        }`}
      >
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
