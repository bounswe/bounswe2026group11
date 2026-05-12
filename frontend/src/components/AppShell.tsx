import { useState, useRef, useEffect } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useDiscoverViewMode } from '@/contexts/DiscoverViewModeContext';
import { UserAvatar } from '@/components/UserAvatar';
import { logout } from '@/services/authService';
import SemLogo from '@/components/SemLogo';
import { useUnreadCountViewModel } from '@/viewmodels/notifications/useUnreadCountViewModel';
import '@/styles/shell.css';

const PRIMARY_NAV_ID = 'primary-navigation';

export default function AppShell() {
  const { t } = useTranslation();
  const { token, username, role, avatarUrl, displayName, refreshToken, clearAuth } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!token;
  const navItems = [
    { to: '/discover', label: t('shell.discover') },
    { to: '/my-events', label: t('shell.my_events') },
    { to: '/favorites', label: t('shell.favorites') },
    { to: '/tickets', label: t('shell.my_tickets') },
    { to: '/invitations', label: t('shell.invitations') },
  ];
  const isAdminPanel = location.pathname.startsWith('/backoffice') || location.pathname.startsWith('/admin-panel');
  const isDiscoverRoute = location.pathname === '/discover';
  const isDarkMode = theme === 'dark';
  const { unreadCount } = useUnreadCountViewModel();
  const { viewMode, setViewMode } = useDiscoverViewMode();
  const loginRequiredMessage = t('shell.login_required');

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
  const handleLockedAction = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        {t('shell.skip_to_content')}
      </a>
      <header className="shell-header">
        <div className="shell-header-inner">
          <NavLink to="/discover" className="shell-logo" onClick={closeMobileMenu}>
            <SemLogo height={56} color={isDarkMode ? '#f9fafb' : '#111827'} />
          </NavLink>

          <nav
            id={PRIMARY_NAV_ID}
            className={`shell-nav ${menuOpen ? 'open' : ''}`}
            aria-label={t('shell.primary_navigation')}
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `shell-nav-link ${isActive && isLoggedIn ? 'active' : ''} ${
                    !isLoggedIn ? 'locked shell-locked-item' : ''
                  }`
                }
                onClick={isLoggedIn ? closeMobileMenu : handleLockedAction}
                aria-disabled={!isLoggedIn}
                title={!isLoggedIn ? loginRequiredMessage : undefined}
              >
                {item.label}
                {!isLoggedIn && (
                  <span className="shell-lock-tooltip" aria-hidden="true">
                    {loginRequiredMessage}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="shell-header-right">
            {isDiscoverRoute && (
              <div className="shell-view-toggle" role="group" aria-label={t('shell.discover_view_mode')}>
                <button
                  type="button"
                  className={`shell-view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                  aria-pressed={viewMode === 'list'}
                  aria-label={t('shell.show_list')}
                  title={t('shell.list')}
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
                  <span className="shell-view-toggle-label">{t('shell.list')}</span>
                </button>
                <button
                  type="button"
                  className={`shell-view-toggle-btn ${viewMode === 'map' ? 'active' : ''}`}
                  onClick={() => setViewMode('map')}
                  aria-pressed={viewMode === 'map'}
                  aria-label={t('shell.show_map')}
                  title={t('shell.map')}
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
                  <span className="shell-view-toggle-label">{t('shell.map')}</span>
                </button>
              </div>
            )}
            <button
              type="button"
              className="shell-theme-btn"
              onClick={toggleTheme}
              aria-label={isDarkMode ? t('shell.switch_to_light_mode') : t('shell.switch_to_dark_mode')}
              title={isDarkMode ? t('shell.switch_to_light_mode') : t('shell.switch_to_dark_mode')}
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
            <NavLink
              to="/notifications"
              className={`shell-bell-btn ${!isLoggedIn ? 'locked shell-locked-item' : ''}`}
              aria-label={
                unreadCount > 0
                  ? t('shell.notifications_unread', { count: unreadCount })
                  : t('shell.notifications')
              }
              aria-disabled={!isLoggedIn}
              title={isLoggedIn ? t('shell.notifications') : loginRequiredMessage}
              onClick={!isLoggedIn ? handleLockedAction : undefined}
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
              {!isLoggedIn && (
                <span className="shell-lock-tooltip" aria-hidden="true">
                  {loginRequiredMessage}
                </span>
              )}
            </NavLink>
            <NavLink
              to="/events/create"
              className={({ isActive }) =>
                `shell-create-btn ${isActive && isLoggedIn ? 'active' : ''} ${
                  !isLoggedIn ? 'locked shell-locked-item' : ''
                }`
              }
              onClick={!isLoggedIn ? handleLockedAction : undefined}
              aria-disabled={!isLoggedIn}
              title={!isLoggedIn ? loginRequiredMessage : undefined}
            >
              {t('shell.create_event')}
              {!isLoggedIn && (
                <span className="shell-lock-tooltip" aria-hidden="true">
                  {loginRequiredMessage}
                </span>
              )}
            </NavLink>
            {role === 'ADMIN' && (
              <NavLink to="/backoffice" className="shell-admin-btn">
                <svg className="shell-admin-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3.5 18 6v5.2c0 3.9-2.4 7.4-6 8.8-3.6-1.4-6-4.9-6-8.8V6l6-2.5Z" />
                </svg>
                <span>{t('shell.admin_panel')}</span>
              </NavLink>
            )}
            {isLoggedIn ? (
                <div className="shell-user-menu" ref={userMenuRef}>
                  <button
                    type="button"
                    className="shell-user-btn"
                    onClick={() => setUserMenuOpen((prev) => !prev)}
                    aria-haspopup="menu"
                    aria-expanded={userMenuOpen}
                    aria-label={t('shell.open_user_menu')}
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
                    <div className="shell-dropdown" role="menu">
                      <NavLink
                        to="/profile"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        {t('shell.profile')}
                      </NavLink>
                      <NavLink
                        to="/invitations"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        {t('shell.invitations')}
                      </NavLink>
                      <NavLink
                        to="/notifications"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        {t('shell.notifications')}
                      </NavLink>
                      <NavLink
                        to="/tickets"
                        className="shell-dropdown-item"
                        onClick={() => setUserMenuOpen(false)}
                        role="menuitem"
                      >
                        {t('shell.my_tickets')}
                      </NavLink>
                      <button
                        className="shell-dropdown-item shell-dropdown-logout"
                        onClick={handleLogout}
                        role="menuitem"
                      >
                        {t('shell.sign_out')}
                      </button>
                    </div>
                  )}
                </div>
            ) : (
              <div className="shell-auth-buttons">
                <NavLink to="/login" className="shell-signin-btn">
                  {t('shell.sign_in')}
                </NavLink>
                <NavLink to="/register" className="shell-signup-btn">
                  {t('shell.sign_up')}
                </NavLink>
              </div>
            )}

            <button
              type="button"
              className="shell-hamburger"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={t('shell.toggle_navigation')}
              aria-controls={PRIMARY_NAV_ID}
              aria-expanded={menuOpen}
            >
              <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
              <span className={`hamburger-line ${menuOpen ? 'open' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      <div
        className={`shell-overlay ${menuOpen ? 'visible' : ''}`}
        onClick={closeMobileMenu}
      />

      <main
        id="main-content"
        tabIndex={-1}
        className={`shell-main ${isAdminPanel ? 'admin-panel-main' : ''} ${
          isDiscoverRoute && viewMode === 'map' ? 'discover-map-main' : ''
        }`}
      >
        <Outlet />
      </main>

      {isLoggedIn && (
        <NavLink to="/events/create" className="shell-fab" aria-label={t('shell.create_event')}>
          +
        </NavLink>
      )}
    </div>
  );
}
