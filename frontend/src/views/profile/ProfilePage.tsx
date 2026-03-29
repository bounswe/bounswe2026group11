import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePage() {
  const { username } = useAuth();

  return (
    <div className="placeholder-page">
      <h1>Profile</h1>
      <p>{username ? `Signed in as ${username}` : 'Your profile details.'}</p>
    </div>
  );
}
