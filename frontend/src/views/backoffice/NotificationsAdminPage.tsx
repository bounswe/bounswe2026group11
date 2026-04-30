import { BackofficePageShell } from './BackofficeListParts';

export default function NotificationsAdminPage() {
  return (
    <BackofficePageShell
      title="Notifications"
      subtitle="Notification sending controls are tracked in the separate admin actions issue."
      filters={null}
    >
      <div className="bo-state">No read-only notification list is available yet.</div>
    </BackofficePageShell>
  );
}
