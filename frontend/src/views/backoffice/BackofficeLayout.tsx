import { NavLink, Outlet } from 'react-router-dom';
import '@/styles/backoffice.css';

const SIDEBAR_ITEMS = [
  { to: '/backoffice/users', label: 'Users' },
  { to: '/backoffice/events', label: 'Events' },
  { to: '/backoffice/participations', label: 'Participations' },
  { to: '/backoffice/tickets', label: 'Tickets' },
  { to: '/backoffice/notifications', label: 'Notifications' },
];

export default function BackofficeLayout() {
  return (
    <div className="bo-layout">
      <aside className="bo-sidebar" aria-label="Admin Panel navigation">
        <div className="bo-sidebar-title">
          <svg className="bo-sidebar-title-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.5 18 6v5.2c0 3.9-2.4 7.4-6 8.8-3.6-1.4-6-4.9-6-8.8V6l6-2.5Z" />
          </svg>
          <span>Admin Panel</span>
        </div>
        <nav className="bo-sidebar-nav">
          {SIDEBAR_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `bo-sidebar-link ${isActive ? 'active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <section className="bo-content">
        <Outlet />
      </section>
    </div>
  );
}
